(() => {
  'use strict';

  const VERTEX_SHADER = `#version 300 es
    layout(location = 0) in vec3 aPosition;
    layout(location = 1) in vec3 aNormal;
    layout(location = 2) in float aVariation;
    uniform mat4 uModel;
    uniform mat4 uViewProjection;
    uniform mat3 uNormalMatrix;
    out vec3 vWorldPosition;
    out vec3 vNormal;
    out float vVariation;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vWorldPosition = world.xyz;
      vNormal = normalize(uNormalMatrix * aNormal);
      vVariation = aVariation;
      gl_Position = uViewProjection * world;
    }
  `;

  const FRAGMENT_SHADER = `#version 300 es
    precision highp float;
    in vec3 vWorldPosition;
    in vec3 vNormal;
    in float vVariation;
    uniform vec4 uColor;
    uniform vec4 uSecondaryColor;
    uniform vec3 uCamera;
    uniform float uEmissive;
    uniform float uSurface;
    out vec4 outColor;
    float surfaceNoise(vec3 point) {
      return fract(sin(dot(point, vec3(12.9898, 78.233, 41.164))) * 43758.5453);
    }
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 lightDirection = normalize(vec3(-0.45, 0.9, 0.72));
      float diffuse = max(dot(normal, lightDirection), 0.0);
      float backLight = max(dot(normal, -lightDirection), 0.0) * 0.16;
      vec3 viewDirection = normalize(uCamera - vWorldPosition);
      float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.4) * 0.38;
      vec3 halfVector = normalize(lightDirection + viewDirection);
      float randomValue = surfaceNoise(floor(vWorldPosition * 85.0) / 85.0);
      float weave = sin(vWorldPosition.y * 38.0 + sin(vWorldPosition.x * 19.0)) * 0.5 + 0.5;
      float detail = 1.0;
      float gloss = 0.16;
      vec3 baseColor = uColor.rgb;
      if (uSurface > 0.5 && uSurface < 1.5) { detail = 0.93 + weave * 0.03 + randomValue * 0.035; gloss = 0.055; }
      if (uSurface > 1.5 && uSurface < 2.5) { detail = 0.82 + randomValue * 0.16; gloss = 0.42; }
      if (uSurface > 2.5 && uSurface < 3.5) { detail = 0.9 + randomValue * 0.08; gloss = 0.82; }
      if (uSurface > 3.5 && uSurface < 4.5) { detail = 0.96 + randomValue * 0.035; gloss = 0.2; }
      if (uSurface > 4.5 && uSurface < 5.5) { float fiberSheen = pow(abs(sin(vWorldPosition.y * 142.0 + vVariation * 11.0)), 16.0); detail = 0.88 + fiberSheen * 0.045 + randomValue * 0.025; gloss = 0.52; baseColor = mix(uColor.rgb, uSecondaryColor.rgb, clamp(vVariation * 0.9 + randomValue * 0.1, 0.0, 1.0)); }
      if (uSurface > 5.5) { detail = 0.92 + weave * 0.12; gloss = 1.0; }
      float specular = pow(max(dot(normal, halfVector), 0.0), mix(14.0, 52.0, gloss)) * gloss;
      float light = 0.27 + diffuse * 0.74 + backLight + rim;
      vec3 color = baseColor * detail * (light + uEmissive) + vec3(1.0, 0.88, 1.0) * specular;
      color += vec3(0.30, 0.12, 0.48) * rim * 0.35;
      outColor = vec4(color, uColor.a);
    }
  `;

  const M4 = {
    identity: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
    multiply(a, b) {
      const out = new Float32Array(16);
      for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 4; row++) {
          out[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
        }
      }
      return out;
    },
    translation: (x, y, z) => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]),
    scale: (x, y, z) => new Float32Array([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]),
    rotationX(angle) {
      const c = Math.cos(angle), s = Math.sin(angle);
      return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
    },
    rotationY(angle) {
      const c = Math.cos(angle), s = Math.sin(angle);
      return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
    },
    rotationZ(angle) {
      const c = Math.cos(angle), s = Math.sin(angle);
      return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]);
    },
    perspective(fov, aspect, near, far) {
      const f = 1 / Math.tan(fov / 2), range = 1 / (near - far);
      return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*range,-1, 0,0,2*far*near*range,0]);
    },
    lookAt(eye, target, up = [0,1,0]) {
      let zx=eye[0]-target[0], zy=eye[1]-target[1], zz=eye[2]-target[2];
      let length=Math.hypot(zx,zy,zz)||1;zx/=length;zy/=length;zz/=length;
      let xx=up[1]*zz-up[2]*zy, xy=up[2]*zx-up[0]*zz, xz=up[0]*zy-up[1]*zx;
      length=Math.hypot(xx,xy,xz)||1;xx/=length;xy/=length;xz/=length;
      const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
      return new Float32Array([
        xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
        -(xx*eye[0]+xy*eye[1]+xz*eye[2]),
        -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
        -(zx*eye[0]+zy*eye[1]+zz*eye[2]),1
      ]);
    },
    point(matrix, point = [0,0,0]) {
      return [
        matrix[0]*point[0]+matrix[4]*point[1]+matrix[8]*point[2]+matrix[12],
        matrix[1]*point[0]+matrix[5]*point[1]+matrix[9]*point[2]+matrix[13],
        matrix[2]*point[0]+matrix[6]*point[1]+matrix[10]*point[2]+matrix[14]
      ];
    }
  };

  const chain = (...matrices) => matrices.reduce((result, matrix) => M4.multiply(result, matrix), M4.identity());
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const damp = (current, target, speed, dt) => current + (target - current) * (1 - Math.exp(-speed * dt));
  const normalMatrix = matrix => {
    const output=new Float32Array(9);
    for(let column=0;column<3;column++){
      const offset=column*4,lengthSquared=matrix[offset]**2+matrix[offset+1]**2+matrix[offset+2]**2||1;
      output[column*3]=matrix[offset]/lengthSquared;output[column*3+1]=matrix[offset+1]/lengthSquared;output[column*3+2]=matrix[offset+2]/lengthSquared;
    }
    return output;
  };

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  function createProgram(gl) {
    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }

  function uploadMesh(gl, geometry) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.normals), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    const variationBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, variationBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geometry.variations||new Array(geometry.positions.length/3).fill(0)),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2,1,gl.FLOAT,false,0,0);
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: geometry.indices.length };
  }

  function sphereGeometry(latitudeBands = 16, longitudeBands = 20) {
    const positions=[], normals=[], variations=[], indices=[];
    for(let latitude=0;latitude<=latitudeBands;latitude++){
      const theta=latitude*Math.PI/latitudeBands, y=Math.cos(theta), radius=Math.sin(theta);
      for(let longitude=0;longitude<=longitudeBands;longitude++){
        const phi=longitude*Math.PI*2/longitudeBands, x=radius*Math.cos(phi), z=radius*Math.sin(phi);
        positions.push(x,y,z);normals.push(x,y,z);variations.push(clamp(.46+Math.sin(phi*7+theta*1.4)*.25+Math.sin(phi*13-theta*1.8)*.14,0,1));
      }
    }
    for(let latitude=0;latitude<latitudeBands;latitude++)for(let longitude=0;longitude<longitudeBands;longitude++){
      const first=latitude*(longitudeBands+1)+longitude, second=first+longitudeBands+1;
      indices.push(first,first+1,second,second,first+1,second+1);
    }
    return {positions,normals,variations,indices};
  }

  function cylinderGeometry(segments = 18, topRadius = 1, bottomRadius = 1) {
    const positions=[],normals=[],indices=[];
    for(let row=0;row<2;row++){
      const y=row?1:-1, radius=row?topRadius:bottomRadius, slope=(bottomRadius-topRadius)*.5;
      for(let segment=0;segment<=segments;segment++){
        const angle=segment*Math.PI*2/segments, x=Math.cos(angle), z=Math.sin(angle), length=Math.hypot(x,slope,z);
        positions.push(x*radius,y,z*radius);normals.push(x/length,slope/length,z/length);
      }
    }
    for(let segment=0;segment<segments;segment++){
      const next=segments+1+segment;indices.push(segment,next,segment+1,next,next+1,segment+1);
    }
    for(const [y,radius,normal] of [[-1,bottomRadius,-1],[1,topRadius,1]]){
      const center=positions.length/3;positions.push(0,y,0);normals.push(0,normal,0);
      const rim=positions.length/3;
      for(let segment=0;segment<=segments;segment++){
        const angle=segment*Math.PI*2/segments;positions.push(Math.cos(angle)*radius,y,Math.sin(angle)*radius);normals.push(0,normal,0);
      }
      for(let segment=0;segment<segments;segment++) normal<0?indices.push(center,rim+segment,rim+segment+1):indices.push(center,rim+segment+1,rim+segment);
    }
    return {positions,normals,indices};
  }

  function boxGeometry() {
    const positions=[],normals=[],indices=[];
    const faces=[[[0,0,1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[[0,0,-1],[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],[[1,0,0],[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],[[-1,0,0],[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],[[0,1,0],[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]],[[0,-1,0],[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]];
    for(const [normal,...vertices] of faces){const start=positions.length/3;for(const vertex of vertices){positions.push(...vertex);normals.push(...normal);}indices.push(start,start+1,start+2,start,start+2,start+3);}
    return {positions,normals,indices};
  }

  function torusGeometry(radialSegments = 12, tubularSegments = 28, tubeRadius = .24) {
    const positions=[],normals=[],indices=[];
    for(let radial=0;radial<=radialSegments;radial++){
      const v=radial*Math.PI*2/radialSegments,cosV=Math.cos(v),sinV=Math.sin(v);
      for(let tubular=0;tubular<=tubularSegments;tubular++){
        const u=tubular*Math.PI*2/tubularSegments,cosU=Math.cos(u),sinU=Math.sin(u);
        positions.push((1+tubeRadius*cosV)*cosU,tubeRadius*sinV,(1+tubeRadius*cosV)*sinU);
        normals.push(cosV*cosU,sinV,cosV*sinU);
      }
    }
    for(let radial=0;radial<radialSegments;radial++)for(let tubular=0;tubular<tubularSegments;tubular++){
      const a=radial*(tubularSegments+1)+tubular,b=(radial+1)*(tubularSegments+1)+tubular;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
    return {positions,normals,indices};
  }

  function skirtGeometry(segments = 48, hike = .84) {
    const positions=[],normals=[],indices=[],rows=[{y:1,r:.43},{y:.18,r:.7},{y:-1,r:1}];
    for(let row=0;row<rows.length;row++){
      const {y,r}=rows[row];
      for(let segment=0;segment<=segments;segment++){
        const angle=segment*Math.PI*2/segments,x=Math.cos(angle),z=Math.sin(angle),raisedSide=(x+z)*.7071,sideLift=row===rows.length-1?Math.pow(Math.max(0,raisedSide),2.2)*hike:0;
        const fold=1+Math.sin(angle*6+row*.7)*.045;
        positions.push(x*r*fold,y+sideLift,z*r*fold);normals.push(x,.16,z);
      }
    }
    for(let row=0;row<rows.length-1;row++)for(let segment=0;segment<segments;segment++){
      const a=row*(segments+1)+segment,b=(row+1)*(segments+1)+segment;
      indices.push(a,a+1,b,b,a+1,b+1);
    }
    return {positions,normals,indices};
  }

  function capeGeometry(columns = 10, rows = 18) {
    const positions=[],normals=[],indices=[];
    for(let row=0;row<=rows;row++){
      const t=row/rows,centerX=-.12-.68*t,halfWidth=.28+.3*t,y=-2.46*t,z=.1+Math.sin(t*Math.PI)*.2;
      for(let column=0;column<=columns;column++){
        const across=column/columns*2-1,x=centerX+across*halfWidth,wave=Math.sin(column*1.7+row*.72)*.07*t,hem=row===rows?(.16+.08*Math.sin(column*2.1))*Math.abs(across):0;
        positions.push(x,y+hem,z+wave);normals.push(-Math.cos(column*1.7+row*.72)*.34*t,.08,1);
      }
    }
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
      const a=row*(columns+1)+column,b=(row+1)*(columns+1)+column;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
    return {positions,normals,indices};
  }

  function hairGeometry(columns = 12, rows = 18) {
    const positions=[],normals=[],variations=[],indices=[];
    for(let row=0;row<=rows;row++){
      const t=row/rows,halfWidth=.07+Math.sin(t*Math.PI)*.34+t*.08,centerX=-.035*t,y=.2-1.58*t,z=.11+Math.sin(t*Math.PI)*.12+.22*Math.pow(t,1.35),earNotch=Math.exp(-Math.pow((t-.235)/.105,2));
      for(let column=0;column<=columns;column++){
        const across=column/columns*2-1,wave=Math.sin(column*2+row*.8)*.035*(.25+t),x=centerX+across*halfWidth-Math.max(0,across)*earNotch*.1;
        positions.push(x,y,z+wave);normals.push(-Math.cos(column*2+row*.8)*.2,.04,1);variations.push(clamp(.1+column/columns*.68+Math.sin(row*1.7+column)*.16,0,1));
      }
    }
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
      const t=(row+.5)/rows,across=(column+.5)/columns*2-1,earDistance=Math.abs(t-.235)/.135,earBoundary=.5+.38*earDistance*earDistance;
      if(earDistance<1&&across>earBoundary)continue;
      const a=row*(columns+1)+column,b=(row+1)*(columns+1)+column;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
    return {positions,normals,variations,indices};
  }

  function crownHairGeometry(layerIndex = 0, rows = 9, columns = 20, sections = 14) {
    const positions=[],normals=[],variations=[],indices=[];
    const random=(index,salt=0)=>{const value=Math.sin((index+1)*19.1987+salt*71.417)*43758.5453;return value-Math.floor(value);};
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
      const strand=layerIndex*rows*columns+row*columns+column,rowPhase=(row+layerIndex*.16)/rows;
      const rootY=.462-rowPhase*.405,rootWidth=.385*Math.sqrt(clamp(1-(rootY/.47)*(rootY/.47),.002,1));
      const stagger=((row+layerIndex)%2?.38:-.38)/columns,across=clamp(column/(columns-1)*2-1+stagger,-1,1);
      const rootX=across*rootWidth+(random(strand,1)-.5)*.007,drop=.13+random(strand,2)*.082+rowPhase*.04,endY=Math.max(-.045,rootY-drop);
      const endWidth=.385*Math.sqrt(clamp(1-(endY/.47)*(endY/.47),.002,1)),flowSide=rootX>=.025?1:-1;
      const targetX=clamp(across*endWidth+flowSide*(.012+random(strand,3)*.025)-.007,-endWidth,endWidth),phase=random(strand,4)*Math.PI*2,waveRate=1.2+random(strand,5)*1.3;
      const strandVariation=clamp(.06+random(strand,6)*.9,0,1),strandStart=positions.length/3,points=[];
      for(let section=0;section<=sections;section++){
        const t=section/sections,eased=t*t*(3-2*t),curlEnvelope=Math.sin(t*Math.PI),x=rootX*(1-eased)+targetX*eased+Math.sin(phase+t*Math.PI*waveRate*1.45)*.0095*curlEnvelope,y=rootY-drop*t+Math.cos(phase+t*Math.PI*2.2)*.0035*curlEnvelope;
        const ellipse=clamp(1-(x/.405)*(x/.405)-(y/.48)*(y/.48),.006,1),z=.365*Math.sqrt(ellipse)+.011+layerIndex*.0027+Math.sin(phase+t*Math.PI*2.5)*.0035;
        points.push([x,y,z]);
      }
      for(let section=0;section<=sections;section++){
        const previous=points[Math.max(0,section-1)],next=points[Math.min(sections,section+1)],dx=next[0]-previous[0],dy=next[1]-previous[1],length=Math.hypot(dx,dy)||1;
        const t=section/sections,bodyWidth=.0032+random(strand,7)*.003,width=bodyWidth*(.42+.58*Math.sin(Math.min(1,t*4)*Math.PI/2))*(1-t*.08),offsetX=-dy/length*width,offsetY=dx/length*width,point=points[section];
        positions.push(point[0]+offsetX,point[1]+offsetY,point[2],point[0]-offsetX,point[1]-offsetY,point[2]);
        normals.push(0,0,1,0,0,1);variations.push(strandVariation,strandVariation);
      }
      for(let section=0;section<sections;section++){
        const a=strandStart+section*2,b=a+2;
        indices.push(a,a+1,b,b,a+1,b+1);
      }
    }
    return {positions,normals,variations,indices};
  }

  function curlGeometry(groupIndex = 0, groupCount = 5, strandCount = 240, sides = 6) {
    const positions=[],normals=[],variations=[],indices=[],columns=48;
    const random=(index,salt=0)=>{const value=Math.sin((index+1)*12.9898+salt*78.233)*43758.5453;return value-Math.floor(value);};
    for(let strand=groupIndex;strand<strandCount;strand+=groupCount){
      const row=Math.floor(strand/columns),column=strand%columns,across=column/(columns-1)*2-1,side=Math.sign(across)||1;
      const scalpArc=Math.sqrt(Math.max(0,1-across*across));
      const width=.35+row*.014,baseX=across*width+(random(strand,1)-.5)*.014,baseY=.105+.22*scalpArc-row*.05+(random(strand,2)-.5)*.016;
      const baseZ=.03+scalpArc*.15+row*.015+(random(strand,3)-.5)*.012,phase=random(strand,4)*Math.PI*2,turns=1.72+random(strand,5)*1.58,amplitude=.031+random(strand,6)*.043;
      const lengthVariation=across>.08?.12+(random(strand,7)-.5)*.08:random(strand,7)*.24;
      const length=.94+scalpArc*.72+lengthVariation+row*.035,sections=Math.round(30+scalpArc*8+random(strand,8)*3),baseRadius=.0056+random(strand,9)*.0044,strandVariation=clamp(random(strand,10)*.86+row*.035,0,1);
      const strandStart=positions.length/3;
      for(let section=0;section<=sections;section++){
        const t=section/sections,curl=phase+t*turns*Math.PI*2+Math.sin(t*Math.PI*2+phase)*.2,waveGrowth=.08+.92*Math.sin(Math.min(1,t*2.6)*Math.PI/2),strandTaper=Math.min(1,.22+t*11)*(.99-.36*Math.pow(t,1.7));
        const radius=Math.max(.0034,baseRadius*strandTaper),softWave=amplitude*waveGrowth,rightBalance=across>.12?.018*t:0;
        const centerY=baseY-length*t+Math.sin(curl*.5)*.012*t,fabricClearance=.22*t*t*(3-2*t);
        const rawX=baseX+Math.sin(curl)*softWave+Math.sin(curl*.47+phase)*.012*t-side*t*.012-.05*Math.pow(t,1.32)+rightBalance;
        const earY=Math.exp(-Math.pow((centerY+.22)/.17,2)),earX=Math.exp(-Math.pow((rawX-.34)/.17,2)),earSeparation=(rawX>.34?.16:-.11)*earY*earX;
        const centerX=rawX+earSeparation,centerZ=baseZ+(1-Math.exp(-t*18))*.14+Math.cos(curl)*softWave*.62+Math.sin(t*Math.PI)*.044+t*.045+fabricClearance;
        for(let ring=0;ring<=sides;ring++){
          const angle=ring*Math.PI*2/sides,x=Math.cos(angle),z=Math.sin(angle);
          positions.push(centerX+x*radius,centerY,centerZ+z*radius);normals.push(x,0,z);variations.push(clamp(strandVariation+Math.sin(t*Math.PI)*.055,0,1));
        }
      }
      for(let section=0;section<sections;section++)for(let ring=0;ring<sides;ring++){
        const a=strandStart+section*(sides+1)+ring,b=a+sides+1;
        indices.push(a,a+1,b,b,a+1,b+1);
      }
    }
    return {positions,normals,variations,indices};
  }

  function color(hex, alpha = 1) {
    const value=parseInt(hex.slice(1),16);
    return [((value>>16)&255)/255,((value>>8)&255)/255,(value&255)/255,alpha];
  }

  class MoonWitch3D {
    constructor(canvas, options = {}) {
      this.canvas=canvas;
      this.options=options;
      this.gl=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:true});
      this.available=Boolean(this.gl);
      this.gait=0;this.walkWeight=0;this.crouchWeight=0;this.castWeight=0;this.jumpWeight=0;
      this.hairAngle=0;this.hairVelocity=0;this.lastTime=performance.now();this.spell='lightning';
      if(!this.gl){canvas.classList.add('witch-3d--unavailable');return;}
      const gl=this.gl, program=createProgram(gl);this.program=program;
      this.uniforms={model:gl.getUniformLocation(program,'uModel'),normal:gl.getUniformLocation(program,'uNormalMatrix'),viewProjection:gl.getUniformLocation(program,'uViewProjection'),color:gl.getUniformLocation(program,'uColor'),secondaryColor:gl.getUniformLocation(program,'uSecondaryColor'),camera:gl.getUniformLocation(program,'uCamera'),emissive:gl.getUniformLocation(program,'uEmissive'),surface:gl.getUniformLocation(program,'uSurface')};
      this.meshes={sphere:uploadMesh(gl,sphereGeometry(20,26)),hairCap:uploadMesh(gl,sphereGeometry(30,58)),crownHairLayers:Array.from({length:6},(_,layer)=>uploadMesh(gl,crownHairGeometry(layer))),cylinder:uploadMesh(gl,cylinderGeometry(22)),skirt:uploadMesh(gl,skirtGeometry()),cape:uploadMesh(gl,capeGeometry()),hair:uploadMesh(gl,hairGeometry()),curls:Array.from({length:5},(_,group)=>uploadMesh(gl,curlGeometry(group))),torus:uploadMesh(gl,torusGeometry()),box:uploadMesh(gl,boxGeometry())};
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    }

    resize() {
      if(!this.available)return;
      const bounds=this.canvas.getBoundingClientRect(), ratio=Math.min(devicePixelRatio||1,1.6);
      const width=Math.max(2,Math.round(bounds.width*ratio)),height=Math.max(2,Math.round(bounds.height*ratio));
      if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
      this.gl.viewport(0,0,width,height);
    }

    draw(mesh, model, material, emissive = 0, surface = 0, secondaryMaterial = material) {
      const gl=this.gl;gl.uniformMatrix4fv(this.uniforms.model,false,model);gl.uniformMatrix3fv(this.uniforms.normal,false,normalMatrix(model));gl.uniform4fv(this.uniforms.color,material);gl.uniform4fv(this.uniforms.secondaryColor,secondaryMaterial);gl.uniform1f(this.uniforms.emissive,emissive);gl.uniform1f(this.uniforms.surface,surface);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
    }

    drawShape(mesh, parent, position, scale, material, rotation = [0,0,0], emissive = 0, surface = 0, secondaryMaterial = material) {
      const model=chain(parent,M4.translation(...position),M4.rotationZ(rotation[2]),M4.rotationY(rotation[1]),M4.rotationX(rotation[0]),M4.scale(...scale));
      this.draw(mesh,model,material,emissive,surface,secondaryMaterial);return model;
    }

    drawSegment(start, end, radius, material, mesh = this.meshes.cylinder, emissive = 0, surface = 0, secondaryMaterial = material) {
      const dx=end[0]-start[0],dy=end[1]-start[1],dz=end[2]-start[2],length=Math.hypot(dx,dy,dz)||.001;
      const yaw=Math.atan2(dx,dz),pitch=Math.acos(clamp(dy/length,-1,1));
      const center=[(start[0]+end[0])/2,(start[1]+end[1])/2,(start[2]+end[2])/2];
      const model=chain(M4.translation(...center),M4.rotationY(yaw),M4.rotationX(pitch),M4.scale(radius,length/2,radius));
      this.draw(mesh,model,material,emissive,surface,secondaryMaterial);return model;
    }

    drawLeg(root, side, upperAngle, kneeAngle, lateralAngle = 0) {
      const boot=color('#35201f'),bootHighlight=color('#754738'),skin=color('#d69a83'),gold=color('#d6a85b'),underSkirt=color('#2e1539');
      const hip=chain(root,M4.translation(side*.29,2.08,0),M4.rotationZ(-side*.045+lateralAngle),M4.rotationX(upperAngle));
      const thighMaterial=side>0?skin:underSkirt,thighSurface=side>0?4:1;
      this.drawShape(this.meshes.cylinder,hip,[0,-.43,0],[.18,.43,.19],thighMaterial,[0,0,0],0,thighSurface);
      this.drawShape(this.meshes.sphere,hip,[0,-.84,0],[.19,.2,.2],thighMaterial,[0,0,0],0,thighSurface);
      if(side>0)this.drawShape(this.meshes.torus,hip,[0,-.22,0],[.17,.12,.17],bootHighlight,[0,0,0],0,2);
      const knee=chain(hip,M4.translation(0,-.84,0),M4.rotationX(kneeAngle));
      this.drawShape(this.meshes.cylinder,knee,[0,-.39,0],[.18,.4,.19],boot,[0,0,0],0,2);
      this.drawShape(this.meshes.torus,knee,[0,-.05,0],[.17,.14,.18],bootHighlight,[0,0,0],0,2);
      this.drawShape(this.meshes.torus,knee,[0,-.42,0],[.16,.08,.17],bootHighlight,[0,0,0],0,2);
      for(const y of [-.2,-.36,-.52,-.68]){
        this.drawShape(this.meshes.sphere,knee,[-.055,y,.19],[.025,.025,.018],gold,[0,0,0],.04,3);
        this.drawShape(this.meshes.sphere,knee,[.055,y,.19],[.025,.025,.018],gold,[0,0,0],.04,3);
      }
      const ankle=M4.point(knee,[0,-.78,0]);
      this.drawShape(this.meshes.sphere,knee,[0,-.82,-.13],[.21,.19,.36],boot,[.08,0,0],0,2);
      this.drawShape(this.meshes.box,knee,[0,-.97,.1],[.075,.13,.08],bootHighlight,[.05,0,0],0,2);
      this.drawShape(this.meshes.sphere,knee,[side*.18,-.38,.18],[.035,.035,.025],gold,[0,0,0],.08,3);
      return ankle;
    }

    drawArm(root, side, shoulderAngle, elbowAngle, castRoll = 0) {
      const sleeve=color(side>0?'#5f287d':'#4f216b'),skin=color('#dba28f'),linen=color('#ded1d2'),leather=color('#3b2424'),gold=color('#c99a51');
      const armX=side<0?-.76:.66,shoulder=chain(root,M4.translation(armX,3.32,.12),M4.rotationZ(-side*(.13+castRoll)),M4.rotationX(shoulderAngle));
      const shoulderStart=M4.point(root,[side*.39,3.36,.04]),shoulderEnd=M4.point(shoulder,[0,-.07,0]);
      this.drawSegment(shoulderStart,shoulderEnd,.13,skin,this.meshes.cylinder,0,4);
      this.drawShape(this.meshes.cylinder,shoulder,[0,-.23,0],[.18,.12,.19],linen,[0,0,0],0,1);
      this.drawShape(this.meshes.torus,shoulder,[0,-.13,0],[.155,.055,.165],color('#f1e6e3'),[0,0,0],0,1);
      this.drawShape(this.meshes.torus,shoulder,[0,-.34,0],[.16,.05,.17],color('#c8b7bd'),[0,0,0],0,1);
      this.drawShape(this.meshes.cylinder,shoulder,[0,-.46,0],[.155,.28,.165],sleeve,[0,0,0],0,1);
      this.drawShape(this.meshes.torus,shoulder,[0,-.69,0],[.15,.07,.16],gold,[0,0,0],.04,3);
      const elbow=chain(shoulder,M4.translation(0,-.73,0),M4.rotationX(elbowAngle));
      this.drawShape(this.meshes.sphere,elbow,[0,0,0],[.16,.16,.16],sleeve,[0,0,0],0,1);
      this.drawShape(this.meshes.cylinder,elbow,[0,-.3,0],[.14,.3,.145],leather,[0,0,0],0,2);
      this.drawShape(this.meshes.torus,elbow,[0,-.48,0],[.13,.08,.13],gold,[0,0,0],.04,3);
      const handMatrix=chain(elbow,M4.translation(0,-.67,0));
      this.drawSegment(M4.point(elbow,[0,-.53,0]),M4.point(handMatrix,[0,.02,0]),.095,skin,this.meshes.cylinder,0,4);
      this.drawShape(this.meshes.sphere,handMatrix,[0,0,0],[.12,.17,.1],skin,[0,0,0],0,4);
      for(let finger=0;finger<4;finger++){
        const x=(finger-1.5)*.042,start=M4.point(handMatrix,[x,-.055,.06]),end=M4.point(handMatrix,[x,-.16,.085+finger*.006]);
        this.drawSegment(start,end,.025,skin,this.meshes.cylinder,0,4);
      }
      this.drawSegment(M4.point(handMatrix,[side*.07,.015,.04]),M4.point(handMatrix,[side*.13,-.085,.085]),.027,skin,this.meshes.cylinder,0,4);
      return handMatrix;
    }

    drawHair(root, sway, lift) {
      const palettes=[['#350b0b','#792019'],['#48100d','#992d20'],['#5c140f','#b63c25'],['#731d13','#d65b32'],['#4e0d0d','#bd4729']];
      this.meshes.curls.forEach((mesh,group)=>this.drawShape(mesh,root,[0,3.92+lift*.04,.2+group*.008],[1,1,1],color(palettes[group][0]),[-sway*(.17+group*.03),0,sway*(.32+group*.05)+(group-2)*.005],0,5,color(palettes[group][1])));
    }

    drawCrownHair(root, sway) {
      const palettes=[['#310809','#7d2119'],['#400b0a','#942b1d'],['#4e0e0b','#aa3721'],['#5c130e','#c04728'],['#6b1911','#d45a31'],['#4a0c0b','#b83d25']];
      this.meshes.crownHairLayers.forEach((mesh,layer)=>this.drawShape(mesh,root,[0,3.96,.15+layer*.0014],[1,1,1],color(palettes[layer][0]),[-sway*(.012+layer*.003),0,(layer-2.5)*.003+sway*(.022+layer*.003)],0,5,color(palettes[layer][1])));
    }

    drawCrescent(parent, position, size, rotation = 0) {
      const frame=chain(parent,M4.translation(...position),M4.rotationZ(rotation));
      let previous=M4.point(frame,[Math.cos(.72)*size,Math.sin(.72)*size,0]);
      for(let section=1;section<=13;section++){
        const angle=.72+(Math.PI*2-1.44)*section/13,next=M4.point(frame,[Math.cos(angle)*size,Math.sin(angle)*size,0]);
        this.drawSegment(previous,next,size*.105,color('#d7ad5c'),this.meshes.cylinder,.08,3);previous=next;
      }
    }

    drawStar(parent, position, size, rotation = 0) {
      const frame=chain(parent,M4.translation(...position),M4.rotationZ(rotation)),gold=color('#e3bd69');
      for(const angle of [0,Math.PI/2,Math.PI/4,-Math.PI/4]){
        const vector=[Math.cos(angle)*size,Math.sin(angle)*size,0],start=M4.point(frame,vector.map(value=>-value)),end=M4.point(frame,vector);
        this.drawSegment(start,end,size*.07,gold,this.meshes.cylinder,.06,3);
      }
    }

    drawCapeTrim(model) {
      const localPoint=(row,column)=>{
        const t=row/18,centerX=-.12-.68*t,halfWidth=.28+.3*t,across=column/10*2-1,hem=row===18?(.16+.08*Math.sin(column*2.1))*Math.abs(across):0;
        return [centerX+across*halfWidth,-2.46*t+hem,.1+Math.sin(t*Math.PI)*.2+Math.sin(column*1.7+row*.72)*.07*t];
      };
      const gold=color('#d6ac59');
      for(const column of [0,10]){
        let previous=M4.point(model,localPoint(0,column));
        for(let row=1;row<=18;row++){const next=M4.point(model,localPoint(row,column));this.drawSegment(previous,next,.017,gold,this.meshes.cylinder,.045,3);previous=next;}
      }
      let previous=M4.point(model,localPoint(18,0));
      for(let column=1;column<=10;column++){const next=M4.point(model,localPoint(18,column));this.drawSegment(previous,next,.017,gold,this.meshes.cylinder,.045,3);previous=next;}
    }

    drawCapeDetails(model) {
      const localPoint=(row,column)=>{
        const t=row/18,centerX=-.12-.68*t,halfWidth=.28+.3*t,across=column/10*2-1,hem=row===18?(.16+.08*Math.sin(column*2.1))*Math.abs(across):0;
        return [centerX+across*halfWidth,-2.46*t+hem,.13+Math.sin(t*Math.PI)*.2+Math.sin(column*1.7+row*.72)*.07*t];
      };
      for(const column of [3,7]){
        let previous=M4.point(model,localPoint(1,column));
        for(let row=2;row<=17;row++){const next=M4.point(model,localPoint(row,column));this.drawSegment(previous,next,.009,color('#8d4caf'),this.meshes.cylinder,0,1);previous=next;}
      }
      this.drawCrescent(model,[-.63,-1.73,.27],.13,-.08);
      this.drawStar(model,[-.35,-1.14,.27],.085,.12);
      this.drawStar(model,[-.82,-2.05,.2],.07,-.2);
    }

    drawStaff(handMatrix, cast, spell, time) {
      const hand=M4.point(handMatrix),grip=[hand[0]+.07,hand[1]+.015,hand[2]+.1];
      const restDirection=[.14,.987,.075],castDirection=[.27,.24,-.932];
      const direction=restDirection.map((value,index)=>value+(castDirection[index]-value)*cast);
      const directionLength=Math.hypot(...direction);for(let i=0;i<3;i++)direction[i]/=directionLength;
      const pointOnStaff=distance=>grip.map((value,index)=>value+direction[index]*distance);
      const bottom=pointOnStaff(-1.58),top=pointOnStaff(2.18);
      this.drawSegment(bottom,top,.078,color('#663921'),this.meshes.cylinder,0,2);
      const highlightOffset=[.026,0,.035];
      this.drawSegment(bottom.map((value,index)=>value+highlightOffset[index]),top.map((value,index)=>value+highlightOffset[index]),.018,color('#d09254'),this.meshes.cylinder,0,2);
      this.drawSegment(pointOnStaff(-.3),pointOnStaff(.34),.105,color('#2b1720'),this.meshes.cylinder,0,2);
      for(const distance of [-1.22,-.58,.68,1.34])this.drawShape(this.meshes.sphere,M4.identity(),pointOnStaff(distance),[.092,.075,.092],color('#8b5731'),[0,0,0],0,2);
      const clawBase=pointOnStaff(2.01),orb=pointOnStaff(2.34);
      this.drawSegment(clawBase,[orb[0]-.19,orb[1]-.05,orb[2]],.043,color('#c49355'),this.meshes.cylinder,.03,3);
      this.drawSegment(clawBase,[orb[0]+.19,orb[1]-.05,orb[2]],.043,color('#c49355'),this.meshes.cylinder,.03,3);
      const spellColor=spell==='frost'?color('#8beeff',.48):spell==='bubble'?color('#ff91df',.48):color('#a56cff',.48);
      const boltColor=spell==='frost'?color('#d8ffff',.95):spell==='bubble'?color('#ffe2fa',.95):color('#efe5ff',.98);
      const pulse=1+Math.sin(time*.006)*.06;
      this.drawShape(this.meshes.sphere,M4.identity(),orb,[.12,.12,.12],color('#f7ecff',.95),[0,0,0],1.8,6);
      for(let bolt=0;bolt<3;bolt++){
        const angle=time*.004+bolt*Math.PI*2/3,start=[orb[0]+Math.cos(angle)*.04,orb[1]-.13+bolt*.1,orb[2]+Math.sin(angle)*.04],mid=[orb[0]+Math.cos(angle+1.2)*.11,orb[1]-.03+bolt*.08,orb[2]+Math.sin(angle+1.2)*.11];
        this.drawSegment(start,mid,.018,boltColor,this.meshes.cylinder,1.6);
      }
      this.drawShape(this.meshes.sphere,M4.identity(),orb,[.27*pulse,.27*pulse,.27*pulse],spellColor,[0,0,0],1.35,6);
      this.drawShape(this.meshes.sphere,M4.identity(),orb,[.36*pulse,.36*pulse,.36*pulse],color('#b277ff',.12),[0,0,0],1.5,6);
    }

    render(pose = {}, time = performance.now()) {
      if(!this.available)return;
      this.resize();
      const dt=Math.min(.05,Math.max(.001,(time-this.lastTime)/1000));this.lastTime=time;
      const speed=clamp(pose.speed||0,0,4),moving=pose.moving?1:0,crouching=pose.crouching?1:0,casting=pose.casting?1:0;
      const forward=clamp(pose.forward||0,-1,1),strafe=clamp(pose.strafe||0,-1,1);
      this.walkWeight=damp(this.walkWeight,moving,9,dt);this.crouchWeight=damp(this.crouchWeight,crouching,12,dt);this.castWeight=damp(this.castWeight,casting,14,dt);
      this.jumpWeight=damp(this.jumpWeight,pose.jumpHeight>.04?1:0,11,dt);this.spell=pose.spell||this.spell;
      this.gait+=dt*(4.8+speed*1.65)*this.walkWeight;
      const direction=forward<-.08?-1:1,stride=Math.sin(this.gait)*direction,step=Math.cos(this.gait),air=this.jumpWeight,crouch=this.crouchWeight,cast=this.castWeight,breath=Math.sin(time*.0018);
      const hairTarget=-stride*this.walkWeight*.12-(pose.turnVelocity||0)*.045-(pose.verticalVelocity||0)*.026+breath*.018;
      this.hairVelocity+=(hairTarget-this.hairAngle)*24*dt;this.hairVelocity*=Math.exp(-7*dt);this.hairAngle+=this.hairVelocity*dt*7;

      const gl=this.gl;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
      const aspect=this.canvas.width/this.canvas.height,compact=this.options.compact;
      const camera=compact?[0,2.65,13.2]:[0,2.72,12.225], target=[0,2.5,0];
      const projection=M4.perspective((compact?36:34)*Math.PI/180,aspect,.1,40),view=M4.lookAt(camera,target);
      gl.uniformMatrix4fv(this.uniforms.viewProjection,false,M4.multiply(projection,view));gl.uniform3fv(this.uniforms.camera,camera);

      const vertical=(pose.jumpHeight||0)*.72-crouch*.48+Math.abs(step)*this.walkWeight*.035+breath*.012;
      const root=chain(M4.translation(strafe*this.walkWeight*.025,vertical,0),M4.rotationY(-.28-strafe*this.walkWeight*.055),M4.rotationZ(stride*this.walkWeight*.012-strafe*this.walkWeight*.045),M4.rotationX(-crouch*.16-forward*this.walkWeight*.035));
      const leftLeg=stride*this.walkWeight*.36+air*.35+crouch*.62,rightLeg=-stride*this.walkWeight*.36+air*.62+crouch*.62;
      const leftKnee=Math.max(0,-stride)*this.walkWeight*.38+air*.78-crouch*1.12;
      const rightKnee=Math.max(0,stride)*this.walkWeight*.38+air*.95-crouch*1.12;
      const lateralStep=strafe*step*this.walkWeight*.14;
      this.drawLeg(root,-1,leftLeg,leftKnee,lateralStep);this.drawLeg(root,1,rightLeg,rightKnee,-lateralStep);

      const cloakSway=-stride*this.walkWeight*.03-this.hairAngle*.18;
      const purple=color('#4d176d'),purpleLight=color('#6d278f'),pink=color('#a94f82'),leather=color('#3b2423'),leatherLight=color('#724536'),gold=color('#d2a756'),skin=color('#d9a087');
      const skirtModel=this.drawShape(this.meshes.skirt,root,[0,2.02-crouch*.08,.02],[.83+crouch*.1,1.12+crouch*.04,.53+crouch*.16],purple,[cloakSway-crouch*.045,0,0],0,1);
      const capeRotation=[cloakSway*.7-crouch*.04,0,-.035+this.hairAngle*.08];
      this.drawShape(this.meshes.cape,root,[0,3.4,.34],[1.065,1.025+crouch*.04,.9+crouch*.1],color('#9c476f'),capeRotation,0,1);
      const capeModel=this.drawShape(this.meshes.cape,root,[0,3.42,.39],[1.02,1+crouch*.04,.88+crouch*.1],purpleLight,capeRotation,0,1);
      this.drawCapeTrim(capeModel);this.drawCapeDetails(capeModel);
      this.drawSegment(M4.point(root,[-.31,3.46,.43]),M4.point(root,[.31,3.46,.43]),.018,gold,this.meshes.cylinder,.04,3);
      this.drawShape(this.meshes.sphere,root,[-.31,3.46,.43],[.055,.055,.035],gold,[0,0,0],.05,3);
      this.drawShape(this.meshes.sphere,root,[.31,3.46,.43],[.055,.055,.035],gold,[0,0,0],.05,3);
      this.drawShape(this.meshes.cape,root,[.58,2.45,.4],[.3,.54,.38],pink,[cloakSway*.45,0,-.08],0,1);
      this.drawShape(this.meshes.sphere,root,[0,3.08,0],[.46,.57+breath*.006,.32],purpleLight,[0,0,-stride*this.walkWeight*.018],0,1);
      this.drawShape(this.meshes.cylinder,root,[0,2.66,.01],[.42,.32,.31],leather,[0,0,0],0,2);
      this.drawShape(this.meshes.torus,root,[0,2.39,.02],[.44,.1,.34],leatherLight,[0,0,0],0,2);
      this.drawShape(this.meshes.torus,root,[0,2.72,.02],[.4,.065,.31],gold,[0,0,0],.04,3);
      this.drawSegment(M4.point(root,[.43,2.43,.24]),M4.point(root,[.62,2.39,.3]),.026,leather,this.meshes.cylinder,0,2);
      this.drawShape(this.meshes.sphere,root,[.63,2.24,.29],[.2,.235,.135],leatherLight,[0,-.16,-.06],0,2);
      this.drawShape(this.meshes.sphere,root,[.63,2.42,.32],[.19,.09,.145],leather,[0,-.16,-.06],0,2);
      this.drawShape(this.meshes.sphere,root,[.63,2.39,.45],[.035,.045,.025],gold,[0,0,0],.05,3);

      const leftArmAngle=-stride*this.walkWeight*.42-air*.28-crouch*.12-cast*.22;
      const rightArmAngle=stride*this.walkWeight*.38-air*.14-crouch*.1+cast*1.33;
      const leftHand=this.drawArm(root,-1,leftArmAngle,.12+Math.max(0,stride)*this.walkWeight*.24+air*.2,cast*.1);
      void leftHand;
      const rightHand=this.drawArm(root,1,rightArmAngle,.1+Math.max(0,-stride)*this.walkWeight*.2,cast*.05);

      this.drawShape(this.meshes.torus,root,[0,3.55,.02],[.38,.16,.34],pink,[0,0,0],0,1);
      this.drawShape(this.meshes.sphere,root,[0,3.88,-.035],[.3,.37,.28],skin,[0,0,0],0,4);
      this.drawShape(this.meshes.hairCap,root,[0,3.96,.15],[.405,.48,.37],color('#570d0c'),[0,0,0],0,5,color('#c8522e'));
      this.drawShape(this.meshes.hair,root,[0,3.95,.27],[1,1,1],color('#47090b'),[-.04-this.hairAngle*.12,0,this.hairAngle*.18],0,5,color('#c95b33'));
      this.drawCrownHair(root,this.hairAngle);
      this.drawHair(root,this.hairAngle,air);
      this.drawShape(this.meshes.sphere,root,[.355,3.79,.49],[.05,.082,.034],color('#cf917e'),[0,-.18,-.08],0,4);
      this.drawShape(this.meshes.sphere,root,[.362,3.79,.525],[.023,.045,.012],color('#a96562'),[0,-.18,-.08],0,4);
      this.drawSegment(M4.point(root,[.36,3.79,.55]),M4.point(root,[.36,3.735,.55]),.009,gold,this.meshes.cylinder,.06,3);
      this.drawSegment(M4.point(root,[0,2.38,.38]),M4.point(root,[.02,2.18,.4]),.012,gold,this.meshes.cylinder,.05,3);
      this.drawCrescent(root,[.02,2.08,.4],.09,-.12);
      this.drawCrescent(root,[.36,3.68,.55],.05,-.16);
      this.drawShape(this.meshes.sphere,root,[.36,3.575,.55],[.032,.05,.032],color('#5d8dff'),[0,0,0],.25,6);
      this.drawStar(skirtModel,[-.28,-.28,1.01],.075,.15);
      this.drawStar(skirtModel,[-.12,-.83,.96],.065,-.08);
      this.drawStaff(rightHand,cast,this.spell,time);
    }
  }

  window.MoonWitch3D=MoonWitch3D;
})();
