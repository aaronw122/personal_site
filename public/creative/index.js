const input = document.querySelector("input")
const canvas = document.getElementById("canvas")

//canvas settings
const ctx = canvas.getContext("2d");
ctx.textBaseline = "top";
ctx.textAlign = "center"

canvas.width = window.innerWidth
canvas.height = window.innerHeight
const startWidth = window.innerWidth / 2
const startHeight = window.innerHeight / 2

let raf;

let letters = [];

const colors = ["red", "orange", "blue", "green", "black"]

const clearFrame = () => {
  letters = [];
}

document.getElementById("erase").addEventListener("click", () => clearFrame())


class letter {
  startHeight = window.innerHeight / 2;
  startWidth = window.innerWidth / 2;
  active = true;
  x = this.startWidth;
  y = this.startHeight;
  bounceCount = 0;
  parabolaX = null;
  parabolaY = 0;
  a = -1;
  b = 0;
  c = 0;
  color = colors[Math.floor(Math.random() * colors.length)];
  direction = 0;
  key = null;
  xIntercepts = [];
  fontSize = (Math.random() * (200 - 20) + 20);

  get font() {
    return `${this.fontSize}px serif`
  }

  get bottomEdge() {
    ctx.font = this.font
    const letterSize = ctx.measureText(this.key)
    return window.innerHeight - (letterSize.actualBoundingBoxDescent)
  }

  set Intercepts({ a, b, c }) {
    // (some help from claude here on quadratic refreshers :) )
    const d = b * b - 4 * a * c;

    if (d < 0) { this.xIntercepts = []; }
    else if (d === 0) { this.xIntercepts = [-b / (2 * a)]; }
    else {
      const sqrtD = Math.sqrt(d)
      this.xIntercepts = [(-b - sqrtD) / (2 * a), (-b + sqrtD) / (2 * a)]
      this.xIntercepts.sort((a, b) => a - b)
    }
  }

  createParabola(){
    if (this.bounceCount === 0) {
      this.a = (Math.random() * (0.1 - 0.01) + 0.01) * -1
      this.b = Math.random() * (5.2 - 2.5) + 2.5
    }
    this.c = 20 - (this.bounceCount ** 2)
    this.direction = Math.floor(2 *Math.random())

    this.Intercepts = { a: this.a, b: this.b, c: this.c }
    this.parabolaX = this.xIntercepts[this.direction]
  }

  parabolaFunc(x) {
    return (this.a*(x**2) + this.b*x + this.c)
  }

  mover () {
    this.direction === 0 ? this.parabolaX += 0.25 : this.parabolaX -= 0.25
    this.parabolaY = this.parabolaFunc(this.parabolaX)

    let newY = this.startHeight - this.parabolaY
    if (newY > this.bottomEdge) {
        newY = this.bottomEdge
    }
    this.y = newY
    this.x = this.startWidth + this.parabolaX - this.xIntercepts[this.direction]
  }

  animation() {
    this.mover()
    //will never be greater than, only equal
    if (this.y >= this.bottomEdge) {
      this.bounceCount += 1
      this.createParabola()

      if (this.xIntercepts.length < 2) {
        this.active = false;
      }
      else {
        this.parabolaX = this.xIntercepts[this.direction]
        this.parabolaY = 0;
        this.startHeight = this.y
        this.startWidth = this.x
      }
    }
  }

  draw() {
    ctx.beginPath()
    ctx.font = `${this.fontSize}px serif`
    ctx.strokeStyle = this.color
    ctx.strokeText(this.key, this.x, this.y)
    ctx.stroke()
  }
}

const globalLoop = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  let anyAlive = false;
  for (const lett of letters) {
    if (lett.active) {
      lett.animation()
      anyAlive = true;
    }
    lett.draw()
  }
  if (anyAlive === true) {
    raf = window.requestAnimationFrame(globalLoop)
  }
  else {
    raf = null;
  }
}

globalLoop()

const handleKeyChange = (e) => {
  e.preventDefault()
  const lett = new letter()
  lett.key = e.key
  letters.push(lett)
  lett.createParabola()
  if (raf === null) {
      globalLoop()
  }
  input.value = "";
}

input.addEventListener("keydown", handleKeyChange)
