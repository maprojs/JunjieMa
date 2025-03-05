function updateTime() {
    const now = new Date();
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayOfWeek = daysOfWeek[now.getDay()];
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear());
    const formattedTime = `${hours}:${minutes}${' '}${year}/${month}/${day}${' '}${dayOfWeek}`;
    document.getElementById('time').textContent = formattedTime;
}
setInterval(updateTime, 60000);
updateTime();