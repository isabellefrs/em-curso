const escapeText = (value = '') => String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const utcStamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const fold = (line) => {
  const parts = [];
  let current = '', bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 73) { parts.push(current); current = ' '; bytes = 1; }
    current += char; bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n');
};
export function criarIcs(eventos, agora = new Date()) {
  const stamp = utcStamp(agora);
  const items = eventos.map((evento) => {
    const [year, month, day] = evento.data.split('-').map(Number);
    const fim = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10).replaceAll('-', '');
    return [
      'BEGIN:VEVENT',
      'UID:' + evento.id + '@emcurso',
      'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + evento.data.replaceAll('-', ''),
      'DTEND;VALUE=DATE:' + fim,
      'SUMMARY:' + escapeText(evento.titulo),
      'DESCRIPTION:' + escapeText(evento.descricao),
      'CATEGORIES:' + escapeText(evento.turma),
      'END:VEVENT',
    ].join('\r\n');
  });
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Em Curso//Calendario escolar//PT-BR','CALSCALE:GREGORIAN','METHOD:PUBLISH',...items,'END:VCALENDAR',''].join('\r\n').split('\r\n').map(fold).join('\r\n');
}
export function baixarIcs(eventos, agora = new Date()) {
  if (!eventos.length) return;
  const blob = new Blob([criarIcs(eventos, agora)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'em-curso-eventos-' + agora.toISOString().slice(0, 10) + '.ics';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
