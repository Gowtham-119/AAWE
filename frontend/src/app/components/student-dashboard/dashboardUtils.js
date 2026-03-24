export const formatRelativeTime = (isoString) => {
  if (!isoString) return 'Live update';

  const timestamp = new Date(isoString);
  if (Number.isNaN(timestamp.getTime())) return 'Live update';

  const diffMs = Date.now() - timestamp.getTime();
  const diffMinutes = Math.floor(Math.abs(diffMs) / 60000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return diffMs >= 0 ? `${diffMinutes} min ago` : `in ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffMs >= 0 ? `${diffHours} hr ago` : `in ${diffHours} hr`;

  const diffDays = Math.floor(diffHours / 24);
  return diffMs >= 0 ? `${diffDays} day${diffDays > 1 ? 's' : ''} ago` : `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
};

export const formatNameFromEmail = (email) => {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized.includes('@')) return '';

  return (normalized.split('@')[0] || '')
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const toDateFromDayAndTime = (dayName, startTime = '09:00', endTime = '10:00') => {
  const dayIndexMap = {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
  };

  const targetDay = dayIndexMap[(dayName || '').toUpperCase()];
  if (targetDay === undefined) return null;

  const now = new Date();
  const currentDay = now.getDay();
  const dayDiff = (targetDay - currentDay + 7) % 7;

  const [startHour, startMinute] = (startTime || '09:00').split(':').map(Number);
  const [endHour, endMinute] = (endTime || '10:00').split(':').map(Number);

  const start = new Date(now);
  start.setDate(now.getDate() + dayDiff);
  start.setHours(Number.isFinite(startHour) ? startHour : 9, Number.isFinite(startMinute) ? startMinute : 0, 0, 0);

  const end = new Date(start);
  end.setHours(Number.isFinite(endHour) ? endHour : start.getHours() + 1, Number.isFinite(endMinute) ? endMinute : 0, 0, 0);

  if (dayDiff === 0 && end < now) {
    start.setDate(start.getDate() + 7);
    end.setDate(end.getDate() + 7);
  }

  return {
    start,
    end,
  };
};
