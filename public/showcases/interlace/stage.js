/* Original stage architecture for Interlace. No reference-video assets are used. */
window.InterlaceStage = (() => {
  const TAU=Math.PI*2;
  const clamp=v=>Math.max(0,Math.min(1,v));
  function draw(ctx,s,p,cs,energy,evolution) {
    const w=ctx.canvas.width,h=ctx.canvas.height,u=Math.min(w,h),t=p*TAU*s.cycles;
    const seedPhase=(Math.sin(s.seed*12.9898)*43758.5453)%1*TAU;
    evolution=evolution+seedPhase*.06;
    const motion=s.motion, breathe=Math.sin(t)*motion;
    const center=s.clearX*w, crest=h*(.16+.06*evolution);
    const palette=(n)=>cs[((n%3)+3)%3];
    const dot=(x,y,r,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,Math.max(.3,r),0,TAU);ctx.fill();};
    const diamond=(x,y,r,c)=>{ctx.strokeStyle=c;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();ctx.stroke();};
    function thread(points,c,alpha,width=1){ctx.globalAlpha=alpha;ctx.strokeStyle=c;ctx.lineWidth=width*s.line;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
    // One connected arch carries the ornament across the full stage.
    function arch(q,lane=0){
      const x=q*w, k=Math.abs(q-.5)*2;
      const form=s.stageStyle==='cathedral'?Math.pow(k,.65):Math.pow(k,1.65);
      return [x,crest+form*h*.68+lane*u*.011+Math.sin(q*TAU*2+t)*u*.025*motion*energy];
    }
    const count=5+s.depth*3;
    ctx.shadowBlur=0;ctx.shadowColor=cs[0];
    for(let lane=0;lane<count;lane++) {
      const pts=[];for(let i=0;i<=100;i++)pts.push(arch(i/100,lane-count/2));
      thread(pts,palette(lane),s.links*s.ribbon*(.4+.55*energy)*(1-lane/count*.35),lane%3===0?2.4:1.1);
      for(let j=0;j<s.detail*3;j++) {
        const q=(j+.5)/(s.detail*3),[x,y]=arch(q,lane-count/2);
        ctx.globalAlpha=s.links*(.25+.6*energy);if(lane%3===0)dot(x,y,u*.0016*(1+.4*breathe),palette(j+lane));
      }
    }
    // Shared branches lead from the canopy to the two large side structures.
    const portalY=h*(s.stageStyle==='portals'?.46:.5), radius=u*(s.stageStyle==='portals'?.29:.25)*s.scale;
    const gap=Math.max(w*.22,s.clearWidth*w*.6+radius*.6);
    const px=[Math.max(radius*.9,center-gap),Math.min(w-radius*.9,center+gap)];
    for(let side=0;side<2;side++) {
      const sign=side===0?-1:1,x=px[side];
      for(let j=0;j<s.detail;j++) {
        const q=.5+sign*(.06+j/s.detail*.4),[ax,ay]=arch(q,0);
        const a=-Math.PI/2+sign*(j/s.detail-.5)*Math.PI;
        const ex=x+Math.cos(a)*radius*.9,ey=portalY+Math.sin(a)*radius*.9;
        ctx.globalAlpha=s.links*(.4+.6*energy);ctx.strokeStyle=palette(j);ctx.lineWidth=s.line*.85;
        ctx.beginPath();ctx.moveTo(ax,ay);ctx.bezierCurveTo(ax,ay+h*.18,ex-sign*radius*.3,ey-radius*.3,ex,ey);ctx.stroke();
        if(s.glyph){ctx.globalAlpha=s.glyph*(.4+.4*energy);diamond(ax,ay,u*(.003+.005*energy),palette(j+1));}
      }
      portal(x,portalY,radius,sign);
    }
    portal(center,crest+u*.055,radius*.45,1);
    // Braided roots carry the same forms down both wings around the deck.
    for(let side=0;side<2;side++)for(let branch=0;branch<s.depth;branch++) {
      const sign=side?1:-1,rootX=px[side],pts=[];
      for(let j=0;j<=70;j++){
        const f=j/70;
        const x=rootX+sign*u*(.04+branch*.035)*Math.sin(f*Math.PI)+Math.sin(f*TAU+evolution*TAU+t)*u*.018*motion*energy;
        const y=portalY+radius*.7+f*(h-portalY-radius*.7);
        pts.push([x,y]);
        if(j%7===0){
          ctx.save();ctx.translate(x,y);ctx.rotate(sign*(.6+f));
          ctx.globalAlpha=s.links*s.petal*(.2+.65*energy);ctx.fillStyle=palette(branch+j);
          ctx.beginPath();ctx.ellipse(0,-u*.016,u*.006,u*.027,Math.sin(t+f)*motion*.25,0,TAU);ctx.fill();
          ctx.restore();
        }
      }
      thread(pts,palette(branch),s.links*(.25+.6*energy),1.8);
    }
    function portal(x,y,r,sign) {
      const t=p*TAU*s.cycles+sign*s.spread*Math.PI,breathe=Math.sin(t)*motion;
      ctx.save();ctx.translate(x,y);ctx.scale(sign,1);
      const rings=s.depth*3+3,n=160;
      for(let k=0;k<rings;k++) {
        const f=(k+1)/rings;
        const rr=r*(.14+f*.86), lobes=4+2*Math.floor(s.detail/3);
        const pts=[];
        for(let i=0;i<=n;i++) {
          const a=i/n*TAU;
          const wave=Math.sin(a*lobes+evolution*TAU+t)*(.025+.04*energy)*motion;
          const shape=1+(.045+.055*evolution)*Math.cos(a*lobes)+wave;
          const an=a+.08*breathe*(1-f);
          pts.push([Math.cos(an)*rr*shape,Math.sin(an)*rr*shape]);
        }
        thread(pts,palette(k),s.orbit*(.5+.5*energy)*(.6+.4*f),k%3===0?2.5:1.2);
        if(k%3===0) {
          const beads=s.detail*4;
          for(let j=0;j<beads;j++) {
            const a=j/beads*TAU+.08*breathe*(1-f);
            const rr2=rr*(1+.06*Math.cos(a*lobes+evolution*TAU));
            ctx.globalAlpha=s.orbit*(.25+.65*energy);
            dot(Math.cos(a)*rr2,Math.sin(a)*rr2,r*(.009+.006*energy),palette(j+k));
          }
        }
      }
      // Petal cells bridge adjacent nested rings, instead of isolated tile stamps.
      for(let j=0;j<s.detail*2;j++) {
        const a=j/(s.detail*2)*TAU+Math.sin(t)*motion*.07;
        ctx.save();ctx.rotate(a);ctx.translate(r*.72,0);
        const size=r*(.08+.04*energy),len=size*(1.6+.4*Math.sin(t+a)*motion);
        const g=ctx.createLinearGradient(-len,0,len,0);g.addColorStop(0,palette(j));g.addColorStop(.5,palette(j+1));g.addColorStop(1,palette(j+2));
        ctx.globalAlpha=s.petal*(.25+.6*energy);ctx.fillStyle=g;
        ctx.beginPath();ctx.moveTo(-len,0);ctx.bezierCurveTo(0,-size,len,-size,len,0);ctx.bezierCurveTo(len,size,0,size,-len,0);ctx.fill();
        ctx.globalAlpha=s.glyph*(.3+.5*energy);ctx.lineWidth=s.line;diamond(len*1.3,0,size*.42,palette(j+2));ctx.restore();
      }
      // Secondary rosettes and braided spokes grow out of the main rings.
      const arms=s.detail+3;
      for(let j=0;j<arms;j++) {
        const a=j/arms*TAU+evolution*.15,rr=r*(1.28+.08*Math.sin(t+a)*motion);
        const sx=Math.cos(a)*rr,sy=Math.sin(a)*rr;
        ctx.globalAlpha=s.links*(.2+.7*energy);ctx.lineWidth=s.line;
        for(let strand=-1;strand<=1;strand++) {
          ctx.strokeStyle=palette(j+strand+3);ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.45,Math.sin(a)*r*.45);
          ctx.quadraticCurveTo(Math.cos(a+.3+strand*.07)*rr,Math.sin(a+.3+strand*.07)*rr,sx,sy);ctx.stroke();
        }
        for(let layer=0;layer<s.depth;layer++) {
          const sr=r*(.05+layer*.035)*(1+.1*breathe);
          const points=[];for(let k=0;k<=40;k++){const b=k/40*TAU;const v=sr*(1+.12*Math.cos(b*5+t)*motion);points.push([sx+Math.cos(b)*v,sy+Math.sin(b)*v]);}
          thread(points,palette(j+layer),s.links*s.orbit*(.15+.75*energy),1);
        }
        ctx.globalAlpha=s.links*s.glyph*(.25+.7*energy);diamond(sx,sy,r*.025,palette(j+1));
      }
      // A quiet core keeps the hierarchy readable at projection scale.
      ctx.globalAlpha=s.orbit;ctx.fillStyle='#000';ctx.beginPath();ctx.arc(0,0,r*.13,0,TAU);ctx.fill();
      thread(Array.from({length:65},(_,i)=>[Math.cos(i/64*TAU)*r*.15,Math.sin(i/64*TAU)*r*.15]),cs[2],s.orbit*.85,2);
      ctx.restore();
    }
    // Central crest and ribs sit above the artist, never on the deck.
    ctx.save();ctx.translate(center,crest+u*.055);
    for(let k=0;k<s.depth;k++) {
      const rr=u*(.035+k*.025)*(1+.04*breathe);
      const pts=[];for(let j=0;j<=80;j++){const a=j/80*TAU;const f=1+.1*Math.cos(a*6+evolution*TAU);pts.push([Math.cos(a)*rr*f,Math.sin(a)*rr*f]);}
      thread(pts,palette(k),s.glyph*(.3+.6*energy),1.3);
    }
    ctx.restore();
    // Flow lines from the wings tie the canopy and portals to the screen edges.
    for(let side=0;side<2;side++)for(let k=0;k<s.depth*3;k++) {
      const sign=side?1:-1,x=px[side],r=radius*(1.05+k*.035);
      ctx.strokeStyle=palette(k);ctx.lineWidth=s.line;ctx.globalAlpha=s.lattice*s.links*(.35+.6*energy);
      ctx.beginPath();ctx.moveTo(x,portalY-r);ctx.bezierCurveTo(x+sign*r*1.7,portalY-r,x+sign*r*1.8,portalY+r,side?w:0,h*(.7+k*.012));ctx.stroke();
    }
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  }
  function clearance(ctx,s) {
    if(s.clearWidth<=0 || s.layout!=='stage')return;
    const w=ctx.canvas.width,h=ctx.canvas.height,cx=s.clearX*w,rw=s.clearWidth*w/2,top=h*(1-s.clearHeight);
    function archPath(x,y,ww,hh){ctx.beginPath();ctx.moveTo(x-ww,h+hh);ctx.lineTo(x-ww,y+hh*.5);ctx.bezierCurveTo(x-ww,y-hh*.08,x+ww,y-hh*.08,x+ww,y+hh*.5);ctx.lineTo(x+ww,h+hh);ctx.closePath();}
    ctx.save();ctx.shadowBlur=0;
    const steps=s.feather>0?16:1;
    for(let k=steps;k>=0;k--){const f=k/Math.max(steps,1)*s.feather*Math.min(w,h);ctx.globalAlpha=k===0?1:.09;ctx.fillStyle='#000';archPath(cx,top-f,rw+f,h-top+f);ctx.fill();}
    ctx.restore();
  }
  return {draw,clearance};
})();
