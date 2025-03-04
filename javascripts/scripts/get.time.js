function updateTime() {
    const now = new Date();
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayOfWeek = daysOfWeek[now.getDay()];
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timezoneOffset = now.getTimezoneOffset();
    const offsetHours = String(Math.abs(Math.floor(timezoneOffset / 60))).padStart(2, '0');
    const offsetMinutes = String(Math.abs(timezoneOffset % 60)).padStart(2, '0');
    const offsetSign = timezoneOffset > 0 ? '-' : '+';
    const formattedTime = `${hours}:${minutes}:${seconds}${' '}${dayOfWeek}${' '}(UTC${offsetSign}${offsetHours}:${offsetMinutes})`;
    document.getElementById('time').textContent = formattedTime;
}
setInterval(updateTime, 1000);
updateTime();