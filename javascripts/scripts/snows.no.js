let canvas=document.querySelector('canvas');
let context=canvas.getContext('2d');
let w=window.innerWidth;
let h=window.innerHeight;
canvas.width=w;
canvas.height=h;
let num=w/4+50;
let snows=[];
for(let i=0;i<num;i++){
  snows.push({
    x:Math.random()*w,
    y:Math.random()*h,
    d:Math.random()*num,
    r:w<1099?Math.random()*2+1:Math.random()*3+1,
  });
};
function drawSnowflake(context,x,y,size) {
  context.beginPath();
  context.moveTo(x,y-size*0.5);
  for (let i=0; i<6; i++) {
    context.lineTo(x+size*Math.sin((i*Math.PI)/3),y-size*Math.cos((i*Math.PI)/3));
  }
  context.closePath();
  context.fillStyle='rgb(255,255,255)';
  context.shadowColor='rgb(255,255,255)';
  context.shadowBlur=10;
  context.fill();
};
let move=()=>{
  for(let i=0;i<num;i++){
    let p=snows[i];
    p.y+=Math.cos(p.d)+1+p.r/2;
    p.x+=Math.sin(p.d);
    if(p.x>w+5||p.x<-5||p.y>h){
      if(i%3>0){
        snows[i]={x:Math.random()*w,y:-10,r:p.r,d:p.d};
      }else{
        if(Math.sin(Date.now())>0){
          snows[i]={x:-5,y:Math.random()*h,r:p.r,d:p.d};
        }else{
          snows[i]={x:w+5,y:Math.random()*h,r:p.r,d:p.d};
        }
      }
    }
  }
};
let draw=()=>{
  context.clearRect(0,0,w,h);
  for (let i=0;i<num;i++) {
    let p=snows[i];
    drawSnowflake(context,p.x,p.y,p.r);
  }
  move();
};
draw();
setInterval(draw,50);
