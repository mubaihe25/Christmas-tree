// script.js

// --- 终极配置 ---
const CONFIG = {
    particleCount: 12000,  // 保持 12000 粒子
    starCount: 1000,       // 保持背景星光
    fov: 900,
    explodeForce: 35,
    returnSpeed: 0.006     
};

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d', { alpha: false }); 
let width, height;

// 纹理缓存
const TEXTURES = {};
const TYPES = ['leaf', 'ballRed', 'ballGold', 'candy', 'gift', 'snow', 'topStar', 'tinyStar'];

// 状态
let camera = { r: 1300, theta: 0.3, phi: 0 }; 
let interaction = { dragging: false, lastX: 0, lastY: 0 };
let explosion = { active: false, time: 0 };
let particles = [];
let stars = []; 
let snowflakes = [];

// --- 1. 纹理生成器 ---
function initTextures() {
    const size = 32;
    const half = size / 2;

    TYPES.forEach(type => {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const t = c.getContext('2d');
        
        // 辅助绘制五角星
        const drawStar = (cx, cy, spikes, outerRadius, innerRadius, color, shadow) => {
            let rot = Math.PI / 2 * 3;
            let x = cx;
            let y = cy;
            let step = Math.PI / spikes;

            t.beginPath();
            t.moveTo(cx, cy - outerRadius);
            for (let i = 0; i < spikes; i++) {
                x = cx + Math.cos(rot) * outerRadius;
                y = cy + Math.sin(rot) * outerRadius;
                t.lineTo(x, y);
                rot += step;

                x = cx + Math.cos(rot) * innerRadius;
                y = cy + Math.sin(rot) * innerRadius;
                t.lineTo(x, y);
                rot += step;
            }
            t.lineTo(cx, cy - outerRadius);
            t.closePath();
            if(shadow) {
                t.shadowColor = shadow;
                t.shadowBlur = 6; // 稍微减小模糊半径防止切边
            }
            t.fillStyle = color;
            t.fill();
            t.shadowBlur = 0; 
        };

        if (type === 'leaf') {
            const g = t.createRadialGradient(half, half, 0, half, half, half);
            g.addColorStop(0, 'rgba(120, 255, 120, 1)');
            g.addColorStop(1, 'rgba(0, 40, 0, 0)');
            t.fillStyle = g;
            t.beginPath(); t.arc(half, half, half/2, 0, Math.PI*2); t.fill();
        }
        else if (type.startsWith('ball')) {
            const color = type === 'ballRed' ? '#e00' : '#fb0';
            const g = t.createRadialGradient(half-4, half-4, 2, half, half, half-2);
            g.addColorStop(0, '#fff');
            g.addColorStop(0.3, color);
            g.addColorStop(1, '#111');
            t.fillStyle = g;
            t.beginPath(); t.arc(half, half, half-3, 0, Math.PI*2); t.fill();
        }
        else if (type === 'candy') {
            t.translate(half, half); t.rotate(Math.PI/6);
            t.strokeStyle = '#fff'; t.lineWidth = 6; t.lineCap = 'round';
            t.beginPath(); t.moveTo(0, 8); t.lineTo(0, -4); 
            t.bezierCurveTo(0, -10, 8, -10, 8, -4); t.stroke();
            t.strokeStyle = '#d00'; t.setLineDash([4, 4]); t.stroke();
        }
        else if (type === 'gift') {
            t.fillStyle = '#c62828'; t.fillRect(6, 6, 20, 20);
            t.fillStyle = '#ffeb3b'; t.fillRect(14, 6, 4, 20); t.fillRect(6, 14, 20, 4);
        }
        else if (type === 'snow') {
            t.fillStyle = '#fff'; t.beginPath(); t.arc(half, half, 3, 0, Math.PI*2); t.fill();
        }
        // --- 修正：调小绘制半径，防止黑框 ---
        else if (type === 'topStar') {
            // 原来是 14，改成 10，留出空间给光晕
            drawStar(half, half, 5, 10, 5, '#fff', '#ffd700'); 
        }
        else if (type === 'tinyStar') {
            drawStar(half, half, 4, 8, 3, '#fff', null);
        }

        TEXTURES[type] = c;
    });
}

// --- 2. 实体类 ---
class Entity {
    constructor(specialType = null) {
        this.reset(specialType);
        this.phase = Math.random() * Math.PI * 2;
    }

    reset(specialType) {
        if (specialType === 'snow') {
            this.type = 'snow';
            this.x = (Math.random() - 0.5) * 2000;
            this.y = Math.random() * 2000 - 1000;
            this.z = (Math.random() - 0.5) * 2000;
            this.size = Math.random() * 2 + 1;
            this.vy = Math.random() * 2 + 1;
            return;
        }

        // --- 修正：减小星星基础尺寸 ---
        if (specialType === 'top') {
            this.type = 'topStar';
            this.homeX = 0;
            this.homeY = -360; 
            this.homeZ = 0;
            this.x = this.homeX; this.y = this.homeY; this.z = this.homeZ;
            this.size = 12; // 原来是 25，改小到 12
            this.vx = 0; this.vy = 0; this.vz = 0;
            return;
        }

        const rand = Math.random();

        // 1. 螺旋彩带
        if (rand < 0.1) {
            const t = Math.random();
            this.homeY = -350 + t * 700;
            const maxR = 20 + t * 280;
            const angle = t * Math.PI * 25; 
            this.homeX = Math.cos(angle) * maxR;
            this.homeZ = Math.sin(angle) * maxR;
            this.type = 'ballGold';
            this.size = 1.2;
        }
        // 2. 表面装饰
        else if (rand < 0.25) {
            this.homeY = Math.random() * 600 - 300;
            const r = ((this.homeY + 300) / 600) * 250;
            const theta = Math.random() * Math.PI * 2;
            const radius = r * (0.95 + Math.random() * 0.1); 
            
            this.homeX = Math.cos(theta) * radius;
            this.homeZ = Math.sin(theta) * radius;
            
            const subRand = Math.random();
            if (subRand < 0.2) this.type = 'gift';
            else if (subRand < 0.5) this.type = 'candy';
            else if (subRand < 0.7) this.type = 'ballRed';
            else this.type = 'tinyStar'; 
            
            this.size = Math.random() * 3 + 3;
        }
        // 3. 树体填充
        else {
            this.homeY = Math.random() * 600 - 300;
            const maxR = ((this.homeY + 300) / 600) * 250;
            const r = maxR * Math.sqrt(Math.random()); 
            const theta = Math.random() * Math.PI * 2;
            
            this.homeX = Math.cos(theta) * r;
            this.homeZ = Math.sin(theta) * r;
            
            if (Math.random() < 0.05) {
                this.type = 'tinyStar';
                this.size = Math.random() * 2 + 2;
            } else {
                this.type = 'leaf';
                this.size = Math.random() * 2 + 0.5;
            }
        }

        this.x = this.homeX; this.y = this.homeY; this.z = this.homeZ;
        this.vx = 0; this.vy = 0; this.vz = 0;
    }

    update() {
        if (this.type === 'snow') {
            this.y += this.vy;
            if (this.y > 1000) this.y = -1000;
            this.x += Math.sin(Date.now() * 0.001 + this.phase) * 0.5;
            return;
        }

        if (explosion.active) {
            this.x += this.vx; this.y += this.vy; this.z += this.vz;
            this.vx *= 0.96; this.vy *= 0.96; this.vz *= 0.96; 

            if (explosion.time > 30) {
                let factor = (explosion.time - 30) * 0.0002;
                factor = Math.min(factor, 0.08);
                this.x += (this.homeX - this.x) * factor;
                this.y += (this.homeY - this.y) * factor;
                this.z += (this.homeZ - this.z) * factor;
            }
        } else {
            if (this.type !== 'topStar') {
                const amp = this.type === 'leaf' ? 1 : 3;
                this.x = this.homeX + Math.sin(Date.now()*0.001 + this.phase) * amp;
                this.y = this.homeY + Math.cos(Date.now()*0.001 + this.phase) * amp;
                this.z = this.homeZ;
            }
        }
    }
}

// --- 3. 渲染循环 ---

function draw() {
    const grad = ctx.createRadialGradient(width/2, height, 0, width/2, height/2, width*1.5);
    grad.addColorStop(0, '#09152b');
    grad.addColorStop(0.5, '#030508');
    grad.addColorStop(1, '#000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    stars.forEach(s => {
        const flicker = Math.sin(Date.now() * 0.003 + s.phase) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha * flicker})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
    });

    camera.phi += (interaction.dragging ? 0 : 0.0015);
    const sinPhi = Math.sin(camera.phi);
    const cosPhi = Math.cos(camera.phi);
    const sinTheta = Math.sin(camera.theta);
    const cosTheta = Math.cos(camera.theta);

    const renderList = [];
    const allEntities = particles.concat(snowflakes);

    if (explosion.active) explosion.time++;
    if (explosion.active && explosion.time > 400) explosion.active = false;

    for (let p of allEntities) {
        p.update();

        let x1 = p.x * cosPhi - p.z * sinPhi;
        let z1 = p.z * cosPhi + p.x * sinPhi;
        let y2 = p.y * cosTheta - z1 * sinTheta;
        let z2 = z1 * cosTheta + p.y * sinTheta;
        let z3 = z2 + camera.r;

        if (z3 < 20) continue; 

        let scale = CONFIG.fov / z3;
        let sx = x1 * scale + width / 2;
        let sy = y2 * scale + height / 2;

        if (sx < -50 || sx > width + 50 || sy < -50 || sy > height + 50) continue;

        renderList.push({ x: sx, y: sy, scale: scale, dist: z3, p: p });
    }

    renderList.sort((a, b) => b.dist - a.dist);

    for (let item of renderList) {
        const p = item.p;
        const img = TEXTURES[p.type];
        
        let size = p.size * item.scale * 5; 
        
        // --- 修正：减小渲染倍率 ---
        // 原来是 size *= 3，现在改成 1.5，配合基础尺寸减小，整体看起来会精致很多
        if (p.type === 'topStar') size *= 1.5;
        
        if (p.type === 'leaf') size *= 0.6;

        let alpha = 1;
        if (p.type === 'tinyStar' || p.type === 'ballGold') {
             alpha = 0.7 + 0.3 * Math.sin(Date.now() * 0.008 + p.phase);
        }
        if (p.type === 'topStar') alpha = 1;

        if (alpha < 0.99) ctx.globalAlpha = alpha;
        
        ctx.drawImage(img, item.x - size/2, item.y - size/2, size, size);
        
        if (alpha < 0.99) ctx.globalAlpha = 1;
    }
}

// --- 初始化 ---

function init() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    
    initTextures();
    particles = [];
    stars = [];
    snowflakes = [];

    particles.push(new Entity('top'));

    for (let i = 0; i < CONFIG.particleCount; i++) {
        particles.push(new Entity());
    }

    for (let i = 0; i < 400; i++) snowflakes.push(new Entity('snow'));

    for (let i = 0; i < CONFIG.starCount; i++) {
        let brightness = Math.pow(Math.random(), 4); 
        stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 2 + 0.5,
            alpha: brightness * 0.9 + 0.1,
            phase: Math.random() * Math.PI * 2
        });
    }

    document.getElementById('status').style.display = 'none';
    document.getElementById('overlay').classList.remove('hidden');
}

const loop = () => { draw(); requestAnimationFrame(loop); };

const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const bgm = document.getElementById('bgm');

startBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    bgm.volume = 0.4;
    bgm.play().catch(()=>{});
    loop();
});

window.addEventListener('mousedown', e => {
    interaction.dragging = true; interaction.lastX = e.clientX; interaction.lastY = e.clientY;
});
window.addEventListener('touchstart', e => {
    interaction.dragging = true; interaction.lastX = e.touches[0].clientX; interaction.lastY = e.touches[0].clientY;
}, {passive: false});
window.addEventListener('mousemove', e => {
    if (interaction.dragging) {
        const dx = e.clientX - interaction.lastX;
        const dy = e.clientY - interaction.lastY;
        camera.phi -= dx * 0.003; camera.theta += dy * 0.003;
        interaction.lastX = e.clientX; interaction.lastY = e.clientY;
    }
});
window.addEventListener('touchmove', e => {
    if (interaction.dragging) {
        e.preventDefault();
        const dx = e.touches[0].clientX - interaction.lastX;
        const dy = e.touches[0].clientY - interaction.lastY;
        camera.phi -= dx * 0.003; camera.theta += dy * 0.003;
        interaction.lastX = e.touches[0].clientX; interaction.lastY = e.touches[0].clientY;
    }
}, {passive: false});
window.addEventListener('mouseup', () => interaction.dragging = false);
window.addEventListener('touchend', () => interaction.dragging = false);
window.addEventListener('wheel', e => {
    camera.r += e.deltaY * 0.5;
    camera.r = Math.max(400, Math.min(camera.r, 2500));
}, {passive: true});

const triggerExplosion = () => {
    if (explosion.active) return;
    explosion.active = true; explosion.time = 0;
    particles.forEach(p => {
        if (p.type === 'snow') return;
        const force = Math.random() * CONFIG.explodeForce;
        const multiplier = p.type === 'topStar' ? 1.5 : 1;
        p.vx = (Math.random() - 0.5) * force * 2 * multiplier;
        p.vy = (Math.random() - 0.5) * force * 2 * multiplier;
        p.vz = (Math.random() - 0.5) * force * 2 * multiplier;
    });
};
window.addEventListener('dblclick', triggerExplosion);

window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
});

init();