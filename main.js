// Pixi startas
const app = new PIXI.Application();
await app.init({ resizeTo: window, background: "#07040f", antialias: true });
document.body.prepend(app.canvas);

// Fyra lager: prickar längst bak, sen bilder, blixtar ovanpå, och en vit flash överst
const dots = new PIXI.Graphics();
const pics = new PIXI.Container();
const bolts = new PIXI.Graphics();
const flash = new PIXI.Graphics();
app.stage.addChild(dots, pics, bolts, flash);

// alla bilder som svävar runt
const sprites = []; 

// input
const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
window.addEventListener("pointermove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
// Klick = blixt där man klickar
window.addEventListener("pointerdown", (e) => strike(e.clientX, e.clientY));
// Mellanslag = blixt på ett slumpat ställe
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    strike(Math.random() * app.screen.width, Math.random() * app.screen.height);
  }
});

//blixtar
// alla blixtar som just nu syns
const activeBolts = []; 
// hur vit skärmen blinkar
let flashAlpha = 0;

// Gör en hackig linje mellan två punkter genom att flytta mittpunkten slumpmässigt
// och sen upprepa på varje delstreck (midpoint displacement)
function makeBolt(x1, y1, x2, y2, offset) {
  let pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  for (let i = 0; i < 5; i++) {
    const next = [];
    for (let j = 0; j < pts.length - 1; j++) {
      const a = pts[j];
      const b = pts[j + 1];
      next.push(a, {
        x: (a.x + b.x) / 2 + (Math.random() - 0.5) * offset,
        y: (a.y + b.y) / 2 + (Math.random() - 0.5) * offset,
      });
    }
    next.push(pts[pts.length - 1]);
    pts = next;
    // mindre skakighet för varje varv
    offset /= 2; 
  }
  return pts;
}

// En blixt från toppen av skärmen ner till (x, y), plus några grenar
function strike(x, y) {
  const main = makeBolt(x + (Math.random() - 0.5) * 300, -10, x, y, 160);
  const paths = [main];
  for (let i = 0; i < 4; i++) {
    const p = main[Math.floor(Math.random() * main.length)];
    const angle = Math.random() * Math.PI * 2;
    const len = 80 + Math.random() * 120;
    paths.push(makeBolt(p.x, p.y, p.x + Math.cos(angle) * len, p.y + Math.sin(angle) * len, 50));
  }
  activeBolts.push({ paths, life: 1 });
  flashAlpha = 0.5; // skärmen blinkar vitt

  // bilderna får en knuff åt ett slumpat håll
  for (const s of sprites) {
    s.vx += (Math.random() - 0.5) * 14;
    s.vy += (Math.random() - 0.5) * 14;
  }
}

// Ritar en lista av punkter som en linje
function drawPath(g, pts) {
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
}

const IMAGE_FILES = [
  "bild1.png",
  "bild2.png",
];

for (const file of IMAGE_FILES) {
  try {
    const texture = await PIXI.Assets.load(file);
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5); // origo i mitten av bilden
    const baseScale = 180 / texture.height; // alla bilder blir ungefär 180 px höga
    sprite.scale.set(baseScale);
    sprite.x = Math.random() * app.screen.width;
    sprite.y = Math.random() * app.screen.height;
    sprite.rotation = (Math.random() - 0.5) * 0.4;
    pics.addChild(sprite);
    sprites.push({ sprite, baseScale, vx: 0, vy: 0 });
  } catch (err) {
    // om en fil saknas eller har fel namn hoppar vi bara över den
    console.warn("Kunde inte ladda bilden:", file);
  }
}

// varje frame
let time = 0;
// rave-tempo, prickarna pulserar i takt
const BPM = 140; 

app.ticker.add((ticker) => {
  time += ticker.deltaMS;

  // Pulsen går från 1 till 0 mellan varje beat
  const beatPhase = ((time / 60000) * BPM) % 1;
  const pulse = Math.pow(1 - beatPhase, 3);

  // Prickrutnätet i två neonfärger som växlar i schackmönster
  dots.clear();
  for (const colorIndex of [0, 1]) {
    for (let x = 0, i = 0; x < app.screen.width; x += 34, i++) {
      for (let y = 0, j = 0; y < app.screen.height; y += 34, j++) {
        if ((i + j) % 2 !== colorIndex) continue;

        // prickar nära musen blir större, och alla pulserar i takt
        const distance = Math.hypot(x - mouse.x, y - mouse.y);
        const size = Math.max(1, 8 - distance / 30) + pulse * 2;
        dots.circle(x, y, size);
      }
    }
    dots.fill(colorIndex === 0 ? "#ff2bd6" : "#3dfcff");
  }

  // Bilderna svävar, pulserar i takt och flyr undan musen
  for (const s of sprites) {
    const dx = s.sprite.x - mouse.x;
    const dy = s.sprite.y - mouse.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 160 && dist > 0) {
      s.vx += (dx / dist) * 0.4; // puffa bort från musen
      s.vy += (dy / dist) * 0.4;
    }
    // lite slumprörelse + friktion så de svävar lugnt
    s.vx = s.vx * 0.98 + (Math.random() - 0.5) * 0.05;
    s.vy = s.vy * 0.98 + (Math.random() - 0.5) * 0.05;
    s.sprite.x += s.vx;
    s.sprite.y += s.vy;
    s.sprite.rotation += s.vx * 0.002;

    // kommer en bild utanför skärmen dyker den upp på andra sidan
    if (s.sprite.x < -150) s.sprite.x = app.screen.width + 150;
    if (s.sprite.x > app.screen.width + 150) s.sprite.x = -150;
    if (s.sprite.y < -150) s.sprite.y = app.screen.height + 150;
    if (s.sprite.y > app.screen.height + 150) s.sprite.y = -150;

    s.sprite.scale.set(s.baseScale * (1 + pulse * 0.1));
  }

  // Blixtarna tonas ut och tas bort när de är slut
  bolts.clear();
  for (let i = activeBolts.length - 1; i >= 0; i--) {
    const b = activeBolts[i];
    // försvinner efter ngra sekunder
    b.life -= ticker.deltaMS / 400; 
    if (b.life <= 0) {
      activeBolts.splice(i, 1);
      continue;
    }
    // Först ett tjockt lila sken, sen en tunn vit kärna ovanpå
    for (const path of b.paths) {
      drawPath(bolts, path);
      bolts.stroke({ width: 8, color: 0xb400ff, alpha: b.life * 0.5 });
      drawPath(bolts, path);
      bolts.stroke({ width: 2, color: 0xffffff, alpha: b.life });
    }
  }

  // Vit flash som tonar ut snabbt
  flashAlpha = Math.max(0, flashAlpha - ticker.deltaMS / 250);
  flash.clear();
  flash.rect(0, 0, app.screen.width, app.screen.height);
  flash.fill({ color: 0xffffff, alpha: flashAlpha });
});