import {getRandomVelocity} from "../utils/utils.js";

export class Ball {
    constructor(x, y, color, radius, speed) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = radius;
        [this.dx, this.dy] = getRandomVelocity(speed*10);
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }

    update(deltaTime, canvas) {
        const deltaSec = deltaTime / 1000;
        this.x += (this.dx/100) * deltaSec * 60;
        this.y += (this.dy/100) * deltaSec * 60;

        if (this.x + this.radius > canvas.width || this.x - this.radius < 0) {
            this.dx = -this.dx;
            this.intervene()
        }
    }

    intervene() {
        this.dy += (Math.random()*5);
        this.dx += (Math.random()*5);
    }

    swap(canvas) {
        this.x = canvas.width - this.x;
        this.y = canvas.height - this.y;
        this.dx *= -1
        this.dy *= -1
    }
}
