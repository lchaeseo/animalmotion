const wrapper = document.querySelector(".turtle-wrapper");

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

let currentX = window.innerWidth / 2;
let currentY = window.innerHeight / 2;

document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

function animate() {
  currentX += (mouseX - currentX) * 0.03;
  currentY += (mouseY - currentY) * 0.03;

  wrapper.style.left = currentX + "px";
  wrapper.style.top = currentY + "px";

  requestAnimationFrame(animate);
}

animate();
