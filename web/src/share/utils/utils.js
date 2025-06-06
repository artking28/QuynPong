
export function getRandomVelocity(speed) {
    const degToRad = (deg) => deg * (Math.PI / 180);
    const angleRanges = [
        [degToRad(30), degToRad(150)],
        [degToRad(210), degToRad(330)],
    ];
    const [min, max] = angleRanges[Math.floor(Math.random() * 2)];
    const angle = Math.random() * (max - min) + min;

    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;

    return [dx, dy];
}
