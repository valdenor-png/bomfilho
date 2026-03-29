// Horarios reais do BomFilho Supermercado
// Seg-Sab: 7:30-13:00 e 15:00-19:30 | Dom/Feriado: 8:00-12:30
const STORE_SCHEDULE = {
  0: [{ open: '08:00', close: '12:30' }],
  1: [{ open: '07:30', close: '13:00' }, { open: '15:00', close: '19:30' }],
  2: [{ open: '07:30', close: '13:00' }, { open: '15:00', close: '19:30' }],
  3: [{ open: '07:30', close: '13:00' }, { open: '15:00', close: '19:30' }],
  4: [{ open: '07:30', close: '13:00' }, { open: '15:00', close: '19:30' }],
  5: [{ open: '07:30', close: '13:00' }, { open: '15:00', close: '19:30' }],
  6: [{ open: '07:30', close: '13:00' }, { open: '15:00', close: '19:30' }],
};

const DAY_NAMES = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function getStoreStatus() {
  const now = new Date();
  const day = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const periods = STORE_SCHEDULE[day] || [];

  for (const period of periods) {
    const openMin = timeToMinutes(period.open);
    const closeMin = timeToMinutes(period.close);
    if (currentMinutes >= openMin && currentMinutes < closeMin) {
      const minutesUntilClose = closeMin - currentMinutes;
      const closingSoon = minutesUntilClose <= 30;
      return {
        isOpen: true,
        closingSoon,
        message: closingSoon
          ? `Fechamos em ${minutesUntilClose} minutos`
          : `Aberto ate ${period.close}`,
      };
    }
  }

  const nextOpen = findNextOpen(day, currentMinutes);
  return { isOpen: false, closingSoon: false, message: nextOpen.message };
}

function findNextOpen(currentDay, currentMinutes) {
  const todayPeriods = STORE_SCHEDULE[currentDay] || [];
  for (const period of todayPeriods) {
    if (timeToMinutes(period.open) > currentMinutes) {
      return { message: `Abrimos hoje as ${period.open}` };
    }
  }
  for (let i = 1; i <= 7; i++) {
    const nextDay = (currentDay + i) % 7;
    const periods = STORE_SCHEDULE[nextDay] || [];
    if (periods.length > 0) {
      return {
        message: i === 1
          ? `Abrimos amanha as ${periods[0].open}`
          : `Abrimos ${DAY_NAMES[nextDay]} as ${periods[0].open}`,
      };
    }
  }
  return { message: 'Horario indisponivel' };
}
