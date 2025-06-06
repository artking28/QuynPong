
export function getRandomVelocity(speed) {
    const degToRad = (deg) => deg * (Math.PI / 180);
    const angleRanges = [
        [degToRad(40), degToRad(140)],
        [degToRad(220), degToRad(320)],
    ];
    const [min, max] = angleRanges[Math.floor(Math.random() * 2)];
    const angle = Math.random() * (max - min) + min;

    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;

    return [dx, dy];
}

export function seconds(n) {
    return n * 1000
}
