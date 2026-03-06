# 🔗 EXEMPLOS DE USO DA API - BOM FILHO MERCADO

## 📋 ÍNDICE
1. [JavaScript/Node.js](#javascript)
2. [Python](#python)
3. [PHP](#php)
4. [cURL (Terminal)](#curl)
5. [Excel VBA](#excel)

---

## 🟨 JavaScript/Node.js {#javascript}

### Importar produtos em massa:

```javascript
const axios = require('axios');

// Seus produtos do sistema atual
const produtos = [
  {
    nome: "Arroz Branco Tipo 1",
    preco: 12.90,
    unidade: "kg",
    categoria: "mercearia",
    emoji: "🍚",
    estoque: 50
  },
  {
    nome: "Feijão Preto",
    preco: 8.50,
    unidade: "kg",
    categoria: "mercearia",
    emoji: "🫘",
    estoque: 40
  },
  {
    nome: "Banana Prata",
    preco: 5.99,
    unidade: "kg",
    categoria: "hortifruti",
    emoji: "🍌",
    estoque: 30
  }
];

// Enviar para a API
async function importarProdutos() {
  try {
    const response = await axios.post('http://localhost:3000/api/admin/produtos/bulk', {
      produtos: produtos
    });
    
    console.log('✅ Sucesso!', response.data);
    console.log('Total importado:', response.data.total_importados);
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

importarProdutos();
```

### Cadastrar produto individual:

```javascript
async function cadastrarProduto(produto) {
  try {
    const response = await axios.post('http://localhost:3000/api/admin/produtos', produto);
    console.log('✅ Produto cadastrado:', response.data);
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

// Exemplo de uso
cadastrarProduto({
  nome: "Coca-Cola 2L",
  preco: 7.99,
  unidade: "un",
  categoria: "bebidas",
  emoji: "🥤",
  estoque: 60
});
```

---

## 🐍 Python {#python}

### Importar produtos em massa:

```python
import requests
import json

# URL da API
API_URL = 'http://localhost:3000/api/admin/produtos/bulk'

# Seus produtos do sistema atual
produtos = [
    {
        "nome": "Arroz Branco Tipo 1",
        "preco": 12.90,
        "unidade": "kg",
        "categoria": "mercearia",
        "emoji": "🍚",
        "estoque": 50
    },
    {
        "nome": "Feijão Preto",
        "preco": 8.50,
        "unidade": "kg",
        "categoria": "mercearia",
        "emoji": "🫘",
        "estoque": 40
    },
    {
        "nome": "Leite Integral 1L",
        "preco": 4.99,
        "unidade": "un",
        "categoria": "mercearia",
        "emoji": "🥛",
        "estoque": 100
    }
]

# Enviar para a API
def importar_produtos():
    try:
        response = requests.post(API_URL, json={'produtos': produtos})
        
        if response.status_code == 201:
            data = response.json()
            print(f'✅ Sucesso! {data["total_importados"]} produtos importados')
        else:
            print(f'❌ Erro: {response.json()}')
            
    except Exception as e:
        print(f'❌ Erro na requisição: {str(e)}')

# Executar
importar_produtos()
```

### Ler do banco de dados e importar:

```python
import mysql.connector
import requests

# Conectar ao banco de dados do seu sistema atual
conexao = mysql.connector.connect(
    host="localhost",
    user="root",
    password="sua_senha",
    database="seu_sistema_mercado"
)

cursor = conexao.cursor(dictionary=True)

# Buscar produtos do sistema atual
cursor.execute("""
    SELECT 
        nome_produto as nome,
        preco,
        'un' as unidade,
        categoria,
        estoque_atual as estoque
    FROM produtos_estoque
    WHERE ativo = 1
""")

produtos = cursor.fetchall()

# Adicionar emoji baseado na categoria
def adicionar_emoji(categoria):
    emojis = {
        'hortifruti': '🥦',
        'mercearia': '🛒',
        'bebidas': '🥤',
        'acougue': '🥩',
        'limpeza': '🧴'
    }
    return emojis.get(categoria, '📦')

for produto in produtos:
    produto['emoji'] = adicionar_emoji(produto['categoria'])

# Enviar para API
response = requests.post('http://localhost:3000/api/admin/produtos/bulk', 
                        json={'produtos': produtos})

print(f'✅ {response.json()["total_importados"]} produtos importados!')

cursor.close()
conexao.close()
```

---

## 🐘 PHP {#php}

### Importar produtos em massa:

```php
<?php
// URL da API
$apiUrl = 'http://localhost:3000/api/admin/produtos/bulk';

// Seus produtos do sistema atual
$produtos = [
    [
        'nome' => 'Arroz Branco Tipo 1',
        'preco' => 12.90,
        'unidade' => 'kg',
        'categoria' => 'mercearia',
        'emoji' => '🍚',
        'estoque' => 50
    ],
    [
        'nome' => 'Feijão Preto',
        'preco' => 8.50,
        'unidade' => 'kg',
        'categoria' => 'mercearia',
        'emoji' => '🫘',
        'estoque' => 40
    ],
    [
        'nome' => 'Banana Prata',
        'preco' => 5.99,
        'unidade' => 'kg',
        'categoria' => 'hortifruti',
        'emoji' => '🍌',
        'estoque' => 30
    ]
];

// Preparar dados
$dados = json_encode(['produtos' => $produtos]);

// Configurar requisição
$opcoes = [
    'http' => [
        'header'  => "Content-Type: application/json\r\n",
        'method'  => 'POST',
        'content' => $dados
    ]
];

$contexto = stream_context_create($opcoes);
$resultado = file_get_contents($apiUrl, false, $contexto);

if ($resultado === false) {
    echo "❌ Erro na requisição\n";
} else {
    $resposta = json_decode($resultado);
    echo "✅ Sucesso! {$resposta->total_importados} produtos importados\n";
}
?>
```

### Ler do MySQL e importar:

```php
<?php
// Conectar ao banco do sistema atual
$conn = new mysqli("localhost", "root", "senha", "sistema_mercado");

if ($conn->connect_error) {
    die("Erro de conexão: " . $conn->connect_error);
}

// Buscar produtos
$sql = "SELECT nome, preco, unidade, categoria, estoque FROM produtos WHERE ativo = 1";
$resultado = $conn->query($sql);

$produtos = [];
while($row = $resultado->fetch_assoc()) {
    // Adicionar emoji
    $emojis = [
        'hortifruti' => '🥦',
        'mercearia' => '🛒',
        'bebidas' => '🥤',
        'acougue' => '🥩',
        'limpeza' => '🧴'
    ];
    
    $row['emoji'] = $emojis[$row['categoria']] ?? '📦';
    $produtos[] = $row;
}

$conn->close();

// Enviar para API
$apiUrl = 'http://localhost:3000/api/admin/produtos/bulk';
$dados = json_encode(['produtos' => $produtos]);

$opcoes = [
    'http' => [
        'header'  => "Content-Type: application/json\r\n",
        'method'  => 'POST',
        'content' => $dados
    ]
];

$contexto = stream_context_create($opcoes);
$resultado = file_get_contents($apiUrl, false, $contexto);
$resposta = json_decode($resultado);

echo "✅ {$resposta->total_importados} produtos importados com sucesso!\n";
?>
```

---

## 💻 cURL (Terminal/Linha de Comando) {#curl}

### Importar um produto:

```bash
curl -X POST http://localhost:3000/api/admin/produtos \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Arroz Branco",
    "preco": 12.90,
    "unidade": "kg",
    "categoria": "mercearia",
    "emoji": "🍚",
    "estoque": 50
  }'
```

### Importar múltiplos produtos:

```bash
curl -X POST http://localhost:3000/api/admin/produtos/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "produtos": [
      {
        "nome": "Arroz Branco",
        "preco": 12.90,
        "unidade": "kg",
        "categoria": "mercearia",
        "emoji": "🍚",
        "estoque": 50
      },
      {
        "nome": "Feijão Preto",
        "preco": 8.50,
        "unidade": "kg",
        "categoria": "mercearia",
        "emoji": "🫘",
        "estoque": 40
      }
    ]
  }'
```

### Importar de arquivo JSON:

```bash
# Criar arquivo produtos.json com:
# {
#   "produtos": [...]
# }

curl -X POST http://localhost:3000/api/admin/produtos/bulk \
  -H "Content-Type: application/json" \
  -d @produtos.json
```

---

## 📊 Excel VBA {#excel}

### Importar produtos direto do Excel:

```vba
Sub ImportarProdutosParaSite()
    Dim http As Object
    Set http = CreateObject("MSXML2.XMLHTTP")
    
    ' URL da API
    Dim apiUrl As String
    apiUrl = "http://localhost:3000/api/admin/produtos/bulk"
    
    ' Construir JSON com produtos
    Dim json As String
    json = "{""produtos"": ["
    
    ' Assumindo que os dados estão na Planilha1
    ' Colunas: A=Nome, B=Preço, C=Unidade, D=Categoria, E=Emoji, F=Estoque
    Dim linha As Integer
    linha = 2 ' Começar na linha 2 (pulando cabeçalho)
    
    Do While Cells(linha, 1).Value <> ""
        If linha > 2 Then json = json & ","
        
        json = json & "{" & _
               """nome"": """ & Cells(linha, 1).Value & """," & _
               """preco"": " & Cells(linha, 2).Value & "," & _
               """unidade"": """ & Cells(linha, 3).Value & """," & _
               """categoria"": """ & Cells(linha, 4).Value & """," & _
               """emoji"": """ & Cells(linha, 5).Value & """," & _
               """estoque"": " & Cells(linha, 6).Value & _
               "}"
        
        linha = linha + 1
    Loop
    
    json = json & "]}"
    
    ' Enviar para API
    http.Open "POST", apiUrl, False
    http.setRequestHeader "Content-Type", "application/json"
    http.send json
    
    ' Verificar resposta
    If http.Status = 201 Then
        MsgBox "✅ Produtos importados com sucesso!", vbInformation
    Else
        MsgBox "❌ Erro ao importar: " & http.responseText, vbCritical
    End If
    
    Set http = Nothing
End Sub
```

---

## 📝 ESTRUTURA DO PRODUTO

```json
{
  "nome": "Nome do Produto",           // OBRIGATÓRIO
  "preco": 12.90,                      // OBRIGATÓRIO (número decimal)
  "unidade": "kg",                     // OBRIGATÓRIO (kg, un, L, etc)
  "categoria": "mercearia",            // OBRIGATÓRIO (hortifruti, mercearia, bebidas, acougue, limpeza)
  "emoji": "🍚",                       // OPCIONAL (padrão: 📦)
  "estoque": 50                        // OPCIONAL (padrão: 0)
}
```

## 📍 ENDPOINTS DISPONÍVEIS

### Produtos:
- `GET    /api/produtos` - Listar todos os produtos
- `POST   /api/admin/produtos` - Cadastrar 1 produto
- `POST   /api/admin/produtos/bulk` - Cadastrar vários produtos
- `DELETE /api/admin/produtos/:id` - Excluir produto

### Pedidos:
- `GET    /api/admin/pedidos` - Listar todos os pedidos
- `PUT    /api/admin/pedidos/:id/status` - Atualizar status

---

## 🎯 CATEGORIAS VÁLIDAS
- `hortifruti` - Frutas, verduras, legumes
- `mercearia` - Arroz, feijão, massas, etc
- `bebidas` - Refrigerantes, sucos, água
- `acougue` - Carnes, frangos, peixes
- `limpeza` - Produtos de limpeza

## 📞 SUPORTE
Em caso de dúvida, verificar os logs do servidor em `backend/`
