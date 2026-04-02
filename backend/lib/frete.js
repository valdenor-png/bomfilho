'use strict';

const VEICULOS_ENTREGA = {
  bike: { consumoKmLitro: null, custoManutencaoKm: 0.12, fatorReparo: 1.1, taxaBase: 3.5 },
  moto: { consumoKmLitro: 30, custoManutencaoKm: 0.2, fatorReparo: 1.5, taxaBase: 5 },
  carro: { consumoKmLitro: 12, custoManutencaoKm: 0.45, fatorReparo: 2.2, taxaBase: 7.5 }
};

function criarFreteService({ criarErroHttp, toMoney, compararTextoSegura: _unused, logger, config, cepGeoCache, fetchWithTimeout }) {
  const { PRECO_COMBUSTIVEL_LITRO, CEP_MERCADO, NUMERO_MERCADO, LIMITE_BIKE_KM, FRETE_DEBUG_LOGS, CEP_GEO_TTL_MS } = config;
  const BRASIL_API_TIMEOUT_MS = Number.parseInt(String(process.env.BRASIL_API_TIMEOUT_MS || '5000'), 10) || 5000;

  function normalizarCep(valor) {
    return String(valor || '').replace(/\D/g, '').slice(0, 8);
  }

  function formatarCep(valor) {
    const cep = normalizarCep(valor);
    if (cep.length !== 8) {
      return cep;
    }

    return `${cep.slice(0, 5)}-${cep.slice(5)}`;
  }

  function normalizarDistanciaEntregaKm(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero <= 0) {
      return 0.5;
    }

    return Number(Math.min(numero, 80).toFixed(1));
  }

  function registrarLogFreteDebug(evento, dados = {}) {
    if (!FRETE_DEBUG_LOGS) {
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      evento: String(evento || 'frete'),
      dados
    };

    logger.info(`FRETE_DEBUG ${JSON.stringify(payload)}`);
  }

  function calcularFreteEntregaDetalhado(veiculoKey, distanciaKm) {
    const veiculo = VEICULOS_ENTREGA[veiculoKey] || VEICULOS_ENTREGA.moto;
    const distanciaBruta = Number(distanciaKm);
    const distanciaNormalizada = normalizarDistanciaEntregaKm(distanciaBruta);
    const custoCombustivelKm = veiculo.consumoKmLitro
      ? PRECO_COMBUSTIVEL_LITRO / veiculo.consumoKmLitro
      : 0;
    const custoOperacionalKm = (custoCombustivelKm + veiculo.custoManutencaoKm) * veiculo.fatorReparo;
    const frete = toMoney(veiculo.taxaBase + (distanciaNormalizada * custoOperacionalKm));

    return {
      frete,
      distancia_bruta_km: Number((Number.isFinite(distanciaBruta) ? distanciaBruta : 0).toFixed(3)),
      distancia_cobrada_km: distanciaNormalizada,
      taxa_base: toMoney(veiculo.taxaBase),
      custo_combustivel_km: Number(custoCombustivelKm.toFixed(4)),
      custo_manutencao_km: Number(veiculo.custoManutencaoKm.toFixed(4)),
      fator_reparo: Number(veiculo.fatorReparo.toFixed(2)),
      custo_operacional_km: Number(custoOperacionalKm.toFixed(4))
    };
  }

  function _calcularFreteEntrega(veiculoKey, distanciaKm) {
    return calcularFreteEntregaDetalhado(veiculoKey, distanciaKm).frete;
  }

  function calcularDistanciaHaversineKm(latA, lonA, latB, lonB) {
    const toRad = (grau) => (grau * Math.PI) / 180;
    const terraKm = 6371;

    const dLat = toRad(latB - latA);
    const dLon = toRad(lonB - lonA);
    const latArad = toRad(latA);
    const latBrad = toRad(latB);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(latArad) * Math.cos(latBrad);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return terraKm * c;
  }

  function normalizarTextoComparacao(valor) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function textoCompativel(textoA, textoB) {
    const a = normalizarTextoComparacao(textoA);
    const b = normalizarTextoComparacao(textoB);

    if (!a || !b) {
      return true;
    }

    return a.includes(b) || b.includes(a);
  }

  function criarCoordenadaFonteValida(latitude, longitude, fonte) {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    return {
      latitude: lat,
      longitude: lon,
      fonte: String(fonte || 'desconhecida')
    };
  }

  function listarCoordenadasPossiveis(localidade) {
    const coordenadas = [];
    const visitados = new Set();

    function adicionar(coord) {
      if (!coord || !Number.isFinite(coord.latitude) || !Number.isFinite(coord.longitude)) {
        return;
      }

      const chave = `${coord.latitude.toFixed(6)}:${coord.longitude.toFixed(6)}`;
      if (visitados.has(chave)) {
        return;
      }

      visitados.add(chave);
      coordenadas.push(coord);
    }

    adicionar(criarCoordenadaFonteValida(localidade?.latitude, localidade?.longitude, localidade?.fonte_coordenadas || 'principal'));
    adicionar(criarCoordenadaFonteValida(localidade?.coordenadas_alternativas?.brasilapi?.latitude, localidade?.coordenadas_alternativas?.brasilapi?.longitude, 'brasilapi'));
    adicionar(criarCoordenadaFonteValida(localidade?.coordenadas_alternativas?.nominatim?.latitude, localidade?.coordenadas_alternativas?.nominatim?.longitude, 'nominatim'));

    return coordenadas;
  }

  function calcularDistanciaEntregaAjustada(origem, destino) {
    const distanciaBase = Number(
      calcularDistanciaHaversineKm(origem.latitude, origem.longitude, destino.latitude, destino.longitude).toFixed(2)
    );

    const coordsOrigem = listarCoordenadasPossiveis(origem);
    const coordsDestino = listarCoordenadasPossiveis(destino);

    let menorDistancia = Number.POSITIVE_INFINITY;
    let melhorPar = null;
    let combinacoesAvaliadas = 0;

    for (const coordOrigem of coordsOrigem) {
      for (const coordDestino of coordsDestino) {
        combinacoesAvaliadas += 1;
        const distancia = Number(
          calcularDistanciaHaversineKm(
            coordOrigem.latitude,
            coordOrigem.longitude,
            coordDestino.latitude,
            coordDestino.longitude
          ).toFixed(2)
        );

        if (!Number.isFinite(distancia) || distancia <= 0) {
          continue;
        }

        if (distancia < menorDistancia) {
          menorDistancia = distancia;
          melhorPar = {
            origem: coordOrigem,
            destino: coordDestino
          };
        }
      }
    }

    const cidadeOrigem = String(origem?.cidade || '').trim().toLowerCase();
    const cidadeDestino = String(destino?.cidade || '').trim().toLowerCase();
    const estadoOrigem = String(origem?.estado || '').trim().toLowerCase();
    const estadoDestino = String(destino?.estado || '').trim().toLowerCase();
    const mesmaCidadeEstado = Boolean(cidadeOrigem && cidadeDestino && cidadeOrigem === cidadeDestino && estadoOrigem && estadoDestino && estadoOrigem === estadoDestino);

    let distanciaFinal = distanciaBase;
    let fonteOrigem = String(origem?.fonte_coordenadas || 'principal');
    let fonteDestino = String(destino?.fonte_coordenadas || 'principal');
    let ajusteAplicado = false;

    if (Number.isFinite(menorDistancia) && Number.isFinite(distanciaBase) && menorDistancia < distanciaBase) {
      const variacao = distanciaBase > 0 ? (distanciaBase - menorDistancia) / distanciaBase : 0;
      const podeAjustar = mesmaCidadeEstado || variacao >= 0.2;

      if (podeAjustar && melhorPar) {
        distanciaFinal = menorDistancia;
        fonteOrigem = melhorPar.origem.fonte;
        fonteDestino = melhorPar.destino.fonte;
        ajusteAplicado = true;
      }
    }

    return {
      metodo_distancia: 'haversine_linha_reta',
      distancia_base_km: distanciaBase,
      distancia_km: Number(distanciaFinal.toFixed(2)),
      fonte_origem: fonteOrigem,
      fonte_destino: fonteDestino,
      ajuste_aplicado: ajusteAplicado,
      combinacoes_avaliadas: combinacoesAvaliadas
    };
  }

  async function buscarCoordenadasPorCep(cep, { numero = '', tipoLocal = 'destino' } = {}) {
    const cepNormalizado = normalizarCep(cep);
    if (cepNormalizado.length !== 8) {
      throw criarErroHttp(400, 'CEP inválido. Informe 8 dígitos.');
    }

    const numeroNormalizado = String(numero || '').trim();
    const chaveCache = numeroNormalizado
      ? `${cepNormalizado}:${numeroNormalizado}`
      : cepNormalizado;
    const cache = cepGeoCache.get(chaveCache);
    const cacheIdadeMs = cache ? Date.now() - cache.cachedAt : null;

    if (cache && cacheIdadeMs < CEP_GEO_TTL_MS) {
      registrarLogFreteDebug('geocode_cache_hit', {
        tipo_local: tipoLocal,
        cep: formatarCep(cepNormalizado),
        numero_referencia: numeroNormalizado || null,
        cache_idade_segundos: Number((cacheIdadeMs / 1000).toFixed(1)),
        fonte_coordenadas: cache.data?.fonte_coordenadas,
        metodo_geocodificacao: cache.data?.metodo_geocodificacao,
        latitude: cache.data?.latitude,
        longitude: cache.data?.longitude
      });

      return cache.data;
    }

    const dados = await buscarDadosCepComFallback(cepNormalizado);

    const coordenadasBrasilApi = criarCoordenadaFonteValida(
      dados?.location?.coordinates?.latitude,
      dados?.location?.coordinates?.longitude,
      'brasilapi'
    );

    const coordenadasNominatimRaw = await buscarCoordenadasNominatim({
      cepNormalizado,
      dadosCep: dados,
      numero: numeroNormalizado,
      tipoLocal
    });
    const coordenadasNominatim = criarCoordenadaFonteValida(
      coordenadasNominatimRaw?.latitude,
      coordenadasNominatimRaw?.longitude,
      coordenadasNominatimRaw?.fonte || 'nominatim'
    );

    // Priorizamos resultado por logradouro quando disponível; caso contrário,
    // mantemos BrasilAPI como primeira fonte e Nominatim como fallback.
    const nominatimEhLogradouro = String(coordenadasNominatimRaw?.nivel_confianca || '').startsWith('logradouro');
    const coordenadaEscolhida = nominatimEhLogradouro
      ? coordenadasNominatim || coordenadasBrasilApi
      : coordenadasBrasilApi || coordenadasNominatim;
    const latitude = Number(coordenadaEscolhida?.latitude);
    const longitude = Number(coordenadaEscolhida?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw criarErroHttp(400, 'CEP sem coordenadas para cálculo de entrega.');
    }

    const resultado = {
      cep: formatarCep(cepNormalizado),
      numero_referencia: numeroNormalizado || null,
      latitude,
      longitude,
      cidade: String(dados?.city || '').trim(),
      estado: String(dados?.state || '').trim(),
      bairro: String(dados?.neighborhood || '').trim(),
      rua: String(dados?.street || '').trim(),
      fonte_coordenadas: String(coordenadaEscolhida?.fonte || 'desconhecida'),
      metodo_geocodificacao: nominatimEhLogradouro
        ? String(coordenadasNominatimRaw?.fonte || 'nominatim_logradouro')
        : coordenadasBrasilApi
          ? 'brasilapi'
          : String(coordenadasNominatimRaw?.fonte || 'nominatim_fallback'),
      coordenadas_alternativas: {
        brasilapi: coordenadasBrasilApi
          ? {
            latitude: coordenadasBrasilApi.latitude,
            longitude: coordenadasBrasilApi.longitude
          }
          : null,
        nominatim: coordenadasNominatim
          ? {
            latitude: coordenadasNominatim.latitude,
            longitude: coordenadasNominatim.longitude,
            tipo_consulta: coordenadasNominatimRaw?.tipo_consulta || null,
            nivel_confianca: coordenadasNominatimRaw?.nivel_confianca || null,
            score: Number.isFinite(Number(coordenadasNominatimRaw?.score)) ? Number(coordenadasNominatimRaw.score) : null,
            consulta: coordenadasNominatimRaw?.consulta || null
          }
          : null
      }
    };

    cepGeoCache.set(chaveCache, {
      cachedAt: Date.now(),
      data: resultado
    });

    registrarLogFreteDebug('geocode_cep', {
      tipo_local: tipoLocal,
      cep: resultado.cep,
      numero_referencia: resultado.numero_referencia,
      cache_hit: false,
      cidade: resultado.cidade,
      estado: resultado.estado,
      bairro: resultado.bairro,
      rua: resultado.rua,
      fonte_coordenadas: resultado.fonte_coordenadas,
      metodo_geocodificacao: resultado.metodo_geocodificacao,
      coordenadas: {
        latitude: resultado.latitude,
        longitude: resultado.longitude
      },
      coordenadas_alternativas: resultado.coordenadas_alternativas
    });

    return resultado;
  }

  async function buscarDadosCepComFallback(cepNormalizado) {
    let dadosV2 = null;

    try {
      const responseV2 = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v2/${cepNormalizado}`, {
        timeoutMs: BRASIL_API_TIMEOUT_MS
      });
      if (responseV2.ok) {
        dadosV2 = await responseV2.json().catch(() => ({}));
      } else if (responseV2.status === 404) {
        throw criarErroHttp(400, 'CEP não encontrado.');
      }
    } catch (erro) {
      if (erro?.status === 400) {
        throw erro;
      }

      logger.warn('Falha ao consultar BrasilAPI CEP v2.', {
        cep: formatarCep(cepNormalizado),
        timeout: erro?.name === 'AbortError',
        message: erro?.message || null
      });
    }

    let dadosV1 = null;
    if (!dadosV2 || !String(dadosV2?.city || '').trim()) {
      try {
        const responseV1 = await fetchWithTimeout(`https://brasilapi.com.br/api/cep/v1/${cepNormalizado}`, {
          timeoutMs: BRASIL_API_TIMEOUT_MS
        });
        if (responseV1.ok) {
          dadosV1 = await responseV1.json().catch(() => ({}));
        } else if (responseV1.status === 404) {
          throw criarErroHttp(400, 'CEP não encontrado.');
        }
      } catch (erro) {
        if (erro?.status === 400) {
          throw erro;
        }

        logger.warn('Falha ao consultar BrasilAPI CEP v1.', {
          cep: formatarCep(cepNormalizado),
          timeout: erro?.name === 'AbortError',
          message: erro?.message || null
        });
      }
    }

    const dadosMesclados = {
      ...(dadosV1 || {}),
      ...(dadosV2 || {}),
      location: dadosV2?.location || dadosV1?.location || null
    };

    if (!Object.keys(dadosMesclados).length) {
      logger.error('Falha ao resolver CEP via BrasilAPI (v1/v2).', {
        cep: formatarCep(cepNormalizado),
        etapa: 'buscarDadosCepComFallback'
      });
      throw criarErroHttp(503, 'Falha ao consultar CEP.');
    }

    return dadosMesclados;
  }

  function montarConsultasNominatim({ cepNormalizado, dadosCep, numero }) {
    const cepFormatado = formatarCep(cepNormalizado);
    const rua = String(dadosCep?.street || '').trim();
    const bairro = String(dadosCep?.neighborhood || '').trim();
    const cidade = String(dadosCep?.city || '').trim();
    const estado = String(dadosCep?.state || '').trim();
    const numeroNormalizado = String(numero || '').trim();

    const consultas = [];

    if (rua && cidade && estado) {
      if (numeroNormalizado) {
        consultas.push({
          texto: [rua, numeroNormalizado, cidade, estado, 'Brasil'].filter(Boolean).join(', '),
          tipo_consulta: 'logradouro_numero',
          nivel_confianca: 'logradouro_numero'
        });
      }

      consultas.push({
        texto: [rua, cidade, estado, 'Brasil'].filter(Boolean).join(', '),
        tipo_consulta: 'logradouro',
        nivel_confianca: 'logradouro'
      });

      if (bairro) {
        consultas.push({
          texto: [rua, bairro, cidade, estado, 'Brasil'].filter(Boolean).join(', '),
          tipo_consulta: 'logradouro_bairro',
          nivel_confianca: 'logradouro'
        });
      }
    }

    consultas.push({
      texto: [cepFormatado, cidade, estado, 'Brasil'].filter(Boolean).join(', '),
      tipo_consulta: 'cep_cidade',
      nivel_confianca: 'cep'
    });
    consultas.push({
      texto: [cepFormatado, 'Brasil'].filter(Boolean).join(', '),
      tipo_consulta: 'cep_generico',
      nivel_confianca: 'cep_generico'
    });

    const consultasUnicas = [];
    const visitadas = new Set();

    for (const consulta of consultas) {
      const texto = String(consulta?.texto || '').trim();
      if (!texto || visitadas.has(texto)) {
        continue;
      }

      visitadas.add(texto);
      consultasUnicas.push({
        ...consulta,
        texto
      });
    }

    return consultasUnicas;
  }

  function resultadoNominatimEhCompativel({ resultado, dadosCep, cepNormalizado, tipoConsulta }) {
    const endereco = resultado?.address || {};
    const cidadeEsperada = String(dadosCep?.city || '').trim();
    const estadoEsperado = String(dadosCep?.state || '').trim();
    const cidadeRetornada =
      endereco?.city
      || endereco?.town
      || endereco?.village
      || endereco?.municipality
      || endereco?.city_district
      || '';
    const estadoRetornado = endereco?.state || endereco?.state_district || '';
    const countryCode = normalizarTextoComparacao(endereco?.country_code);

    if (countryCode && countryCode !== 'br') {
      return false;
    }

    if (!textoCompativel(cidadeRetornada, cidadeEsperada) || !textoCompativel(estadoRetornado, estadoEsperado)) {
      return false;
    }

    const consultaPorCep = String(tipoConsulta || '').startsWith('cep');
    if (consultaPorCep) {
      const cepRetornado = normalizarCep(endereco?.postcode || '');
      if (cepRetornado && cepRetornado.slice(0, 5) !== cepNormalizado.slice(0, 5)) {
        return false;
      }
    }

    return true;
  }

  function pontuarResultadoNominatim({ resultado, dadosCep, cepNormalizado, numero }) {
    const endereco = resultado?.address || {};
    const cepRetornado = normalizarCep(endereco?.postcode || '');
    const cepEsperadoPrefixo5 = String(cepNormalizado || '').slice(0, 5);
    const cepEsperadoPrefixo3 = String(cepNormalizado || '').slice(0, 3);
    const ruaEsperada = normalizarTextoComparacao(dadosCep?.street || '');
    const ruaRetornada = normalizarTextoComparacao(endereco?.road || '');
    const bairroEsperado = normalizarTextoComparacao(dadosCep?.neighborhood || '');
    const bairroRetornado = normalizarTextoComparacao(endereco?.suburb || endereco?.quarter || endereco?.neighbourhood || '');
    const numeroEsperado = String(numero || '').trim();
    const numeroRetornado = String(endereco?.house_number || '').trim();

    let score = 0;

    if (cepRetornado) {
      if (cepRetornado.slice(0, 5) === cepEsperadoPrefixo5) {
        score += 40;
      } else if (cepRetornado.slice(0, 3) === cepEsperadoPrefixo3) {
        score += 20;
      } else {
        score -= 15;
      }
    } else {
      score -= 3;
    }

    if (ruaEsperada && ruaRetornada && textoCompativel(ruaRetornada, ruaEsperada)) {
      score += 10;
    }

    if (bairroEsperado && bairroRetornado && textoCompativel(bairroRetornado, bairroEsperado)) {
      score += 6;
    }

    if (numeroEsperado && numeroRetornado && numeroEsperado === numeroRetornado) {
      score += 8;
    }

    return score;
  }

  async function buscarCoordenadasNominatim({ cepNormalizado, dadosCep, numero, tipoLocal }) {
    const consultas = montarConsultasNominatim({ cepNormalizado, dadosCep, numero });
    if (!consultas.length) {
      return null;
    }

    const headers = {
      'User-Agent': 'BomFilhoFrete/1.0 (fallback-cep)',
      'Accept-Language': 'pt-BR,pt;q=0.9'
    };

    for (const consulta of consultas) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(consulta.texto)}&format=jsonv2&limit=5&addressdetails=1&countrycodes=br`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
          continue;
        }

        const resultados = await response.json().catch(() => []);
        const candidatos = Array.isArray(resultados) ? resultados : [];
        let melhorCandidato = null;

        for (const candidato of candidatos) {
          const latitude = Number(candidato?.lat);
          const longitude = Number(candidato?.lon);

          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            continue;
          }

          const compativel = resultadoNominatimEhCompativel({
            resultado: candidato,
            dadosCep,
            cepNormalizado,
            tipoConsulta: consulta.tipo_consulta
          });
          if (!compativel) {
            continue;
          }

          const score = pontuarResultadoNominatim({
            resultado: candidato,
            dadosCep,
            cepNormalizado,
            numero
          });

          if (!melhorCandidato || score > melhorCandidato.score) {
            melhorCandidato = {
              score,
              latitude,
              longitude,
              candidato
            };
          }
        }

        if (melhorCandidato) {
          return {
            latitude: melhorCandidato.latitude,
            longitude: melhorCandidato.longitude,
            consulta: consulta.texto,
            tipo_consulta: consulta.tipo_consulta,
            nivel_confianca: consulta.nivel_confianca,
            score: melhorCandidato.score,
            display_name: String(melhorCandidato.candidato?.display_name || '').trim() || null,
            fonte: `nominatim_${consulta.tipo_consulta}`
          };
        }
      } catch {
        // Ignora falha de fallback para tentar a proxima consulta.
      }
    }

    registrarLogFreteDebug('nominatim_sem_match', {
      tipo_local: tipoLocal || 'desconhecido',
      cep: formatarCep(cepNormalizado),
      cidade: String(dadosCep?.city || '').trim(),
      estado: String(dadosCep?.state || '').trim(),
      rua: String(dadosCep?.street || '').trim(),
      numero_referencia: String(numero || '').trim() || null
    });

    return null;
  }

  async function calcularEntregaPorCep({ cepDestino, veiculo, numeroDestino = '' }) {
    const veiculoKey = String(veiculo || 'moto').trim().toLowerCase();
    if (!VEICULOS_ENTREGA[veiculoKey]) {
      throw criarErroHttp(400, 'Veículo de entrega inválido');
    }

    // Limitacao tecnica atual: sem numero de destino, a precisao do geocoding pode
    // cair para nivel de CEP/logradouro aproximado (nao rota viaria porta a porta).
    const origem = await buscarCoordenadasPorCep(CEP_MERCADO, {
      numero: NUMERO_MERCADO,
      tipoLocal: 'origem'
    });
    const destino = await buscarCoordenadasPorCep(cepDestino, {
      numero: numeroDestino,
      tipoLocal: 'destino'
    });
    const cepOrigemNormalizado = normalizarCep(origem.cep);
    const cepDestinoNormalizado = normalizarCep(destino.cep);
    const numeroOrigemNormalizado = String(NUMERO_MERCADO || '').replace(/\D/g, '');
    const numeroDestinoNormalizado = String(numeroDestino || '').replace(/\D/g, '');
    const mesmoNumeroLoja = Boolean(
      numeroOrigemNormalizado
      && numeroDestinoNormalizado
      && numeroOrigemNormalizado === numeroDestinoNormalizado
    );
    const mesmaRua = textoCompativel(origem.rua, destino.rua);
    const mesmoBairro = textoCompativel(origem.bairro, destino.bairro);
    const enderecoEhLoja = cepOrigemNormalizado === cepDestinoNormalizado && (mesmoNumeroLoja || (mesmaRua && mesmoBairro));

    let distanciaInfo = calcularDistanciaEntregaAjustada(origem, destino);
    let distanciaKm = Number(distanciaInfo.distancia_km);

    if (enderecoEhLoja) {
      distanciaInfo = {
        ...distanciaInfo,
        distancia_base_km: Number(distanciaInfo.distancia_base_km || 0),
        distancia_km: 0,
        ajuste_aplicado: true,
        metodo_distancia: 'endereco_loja_zerado'
      };
      distanciaKm = 0;
    }

    if (!Number.isFinite(distanciaKm)) {
      throw criarErroHttp(500, 'Não foi possível calcular a distância da entrega.');
    }

    if (veiculoKey === 'bike' && distanciaKm > LIMITE_BIKE_KM) {
      throw criarErroHttp(
        400,
        `Bike disponível apenas para até ${LIMITE_BIKE_KM.toFixed(1)} km do mercado (${formatarCep(CEP_MERCADO)}).`
      );
    }

    const freteDetalhado = enderecoEhLoja
      ? {
        frete: 0,
        distancia_bruta_km: Number(distanciaInfo.distancia_base_km || 0),
        distancia_cobrada_km: 0,
        taxa_base: 0,
        custo_combustivel_km: 0,
        custo_manutencao_km: 0,
        fator_reparo: 1,
        custo_operacional_km: 0
      }
      : calcularFreteEntregaDetalhado(veiculoKey, distanciaKm);

    registrarLogFreteDebug('simulacao_frete', {
      origem: {
        cep: origem.cep,
        numero: NUMERO_MERCADO,
        cidade: origem.cidade,
        estado: origem.estado,
        bairro: origem.bairro,
        rua: origem.rua,
        latitude: origem.latitude,
        longitude: origem.longitude,
        fonte: origem.fonte_coordenadas,
        metodo_geocodificacao: origem.metodo_geocodificacao || null
      },
      destino: {
        cep: destino.cep,
        numero: String(numeroDestino || '').trim() || null,
        cidade: destino.cidade,
        estado: destino.estado,
        bairro: destino.bairro,
        rua: destino.rua,
        latitude: destino.latitude,
        longitude: destino.longitude,
        fonte: destino.fonte_coordenadas,
        metodo_geocodificacao: destino.metodo_geocodificacao || null
      },
      metodo_distancia: distanciaInfo.metodo_distancia,
      distancia_bruta_km: distanciaInfo.distancia_base_km,
      distancia_final_km: distanciaInfo.distancia_km,
      distancia_cobrada_km: freteDetalhado.distancia_cobrada_km,
      ajuste_aplicado: distanciaInfo.ajuste_aplicado,
      combinacoes_avaliadas: distanciaInfo.combinacoes_avaliadas,
      veiculo: veiculoKey,
      frete: {
        valor_final: freteDetalhado.frete,
        taxa_base: freteDetalhado.taxa_base,
        custo_operacional_km: freteDetalhado.custo_operacional_km,
        custo_combustivel_km: freteDetalhado.custo_combustivel_km,
        custo_manutencao_km: freteDetalhado.custo_manutencao_km,
        fator_reparo: freteDetalhado.fator_reparo
      }
    });

    return {
      veiculo: veiculoKey,
      frete: freteDetalhado.frete,
      distancia_km: distanciaKm,
      distancia_cobrada_km: freteDetalhado.distancia_cobrada_km,
      metodo_distancia: distanciaInfo.metodo_distancia,
      distancia_base_km: Number(distanciaInfo.distancia_base_km),
      endereco_loja: enderecoEhLoja,
      cep_origem: origem.cep,
      numero_origem: NUMERO_MERCADO,
      fonte_coordenadas_origem: distanciaInfo.fonte_origem,
      cep_destino: destino.cep,
      numero_destino: String(numeroDestino || '').trim() || null,
      fonte_coordenadas_destino: distanciaInfo.fonte_destino,
      cidade_destino: destino.cidade,
      bairro_destino: destino.bairro
    };
  }

  return {
    calcularEntregaPorCep,
    normalizarCep,
    formatarCep,
    VEICULOS_ENTREGA,
  };
}

module.exports = { criarFreteService, VEICULOS_ENTREGA };
