(() => {
  'use strict';

  const VERTEX_SHADER = `#version 300 es
    layout(location = 0) in vec3 aPosition;
    layout(location = 1) in vec3 aNormal;
    uniform mat4 uModel;
    uniform mat4 uViewProjection;
    uniform mat3 uNormalMatrix;
    out vec3 vWorldPosition;
    out vec3 vNormal;
    void main() {
      vec4 world = uModel * vec4(aPosition, 1.0);
      vWorldPosition = world.xyz;
      vNormal = normalize(uNormalMatrix * aNormal);
      gl_Position = uViewProjection * world;
    }
  `;

  const FRAGMENT_SHADER = `#version 300 es
    precision highp float;
    in vec3 vWorldPosition;
    in vec3 vNormal;
    uniform vec4 uColor;
    uniform vec3 uCamera;
    uniform float uEmissive;
    out vec4 outColor;
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 lightDirection = normalize(vec3(-0.45, 0.9, 0.72));
      float diffuse = max(dot(normal, lightDirection), 0.0);
      float backLight = max(dot(normal, -lightDirection), 0.0) * 0.16;
      vec3 viewDirection = normalize(uCamera - vWorldPosition);
      float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.4) * 0.38;
      vec3 halfVector = normalize(lightDirection + viewDirection);
      float specular = pow(max(dot(normal, halfVector), 0.0), 30.0) * 0.22;
      float light = 0.28 + diffuse * 0.72 + backLight + rim + specular;
      vec3 color = uColor.rgb * (light + uEmissive);
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
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: geometry.indices.length };
  }

  function sphereGeometry(latitudeBands = 16, longitudeBands = 20) {
    const positions=[], normals=[], indices=[];
    for(let latitude=0;latitude<=latitudeBands;latitude++){
      const theta=latitude*Math.PI/latitudeBands, y=Math.cos(theta), radius=Math.sin(theta);
      for(let longitude=0;longitude<=longitudeBands;longitude++){
        const phi=longitude*Math.PI*2/longitudeBands, x=radius*Math.cos(phi), z=radius*Math.sin(phi);
        positions.push(x,y,z);normals.push(x,y,z);
      }
    }
    for(let latitude=0;latitude<latitudeBands;latitude++)for(let longitude=0;longitude<longitudeBands;longitude++){
      const first=latitude*(longitudeBands+1)+longitude, second=first+longitudeBands+1;
      indices.push(first,first+1,second,second,first+1,second+1);
    }
    return {positions,normals,indices};
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
      this.uniforms={model:gl.getUniformLocation(program,'uModel'),normal:gl.getUniformLocation(program,'uNormalMatrix'),viewProjection:gl.getUniformLocation(program,'uViewProjection'),color:gl.getUniformLocation(program,'uColor'),camera:gl.getUniformLocation(program,'uCamera'),emissive:gl.getUniformLocation(program,'uEmissive')};
      this.meshes={sphere:uploadMesh(gl,sphereGeometry(20,26)),cylinder:uploadMesh(gl,cylinderGeometry(22)),cloak:uploadMesh(gl,cylinderGeometry(32,.42,1)),box:uploadMesh(gl,boxGeometry())};
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    }

    resize() {
      if(!this.available)return;
      const bounds=this.canvas.getBoundingClientRect(), ratio=Math.min(devicePixelRatio||1,1.6);
      const width=Math.max(2,Math.round(bounds.width*ratio)),height=Math.max(2,Math.round(bounds.height*ratio));
      if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
      this.gl.viewport(0,0,width,height);
    }

    draw(mesh, model, material, emissive = 0) {
      const gl=this.gl;gl.uniformMatrix4fv(this.uniforms.model,false,model);gl.uniformMatrix3fv(this.uniforms.normal,false,normalMatrix(model));gl.uniform4fv(this.uniforms.color,material);gl.uniform1f(this.uniforms.emissive,emissive);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
    }

    drawShape(mesh, parent, position, scale, material, rotation = [0,0,0], emissive = 0) {
      const model=chain(parent,M4.translation(...position),M4.rotationZ(rotation[2]),M4.rotationY(rotation[1]),M4.rotationX(rotation[0]),M4.scale(...scale));
      this.draw(mesh,model,material,emissive);return model;
    }

    drawSegment(start, end, radius, material, mesh = this.meshes.cylinder, emissive = 0) {
      const dx=end[0]-start[0],dy=end[1]-start[1],dz=end[2]-start[2],length=Math.hypot(dx,dy,dz)||.001;
      const yaw=Math.atan2(dx,dz),pitch=Math.acos(clamp(dy/length,-1,1));
      const center=[(start[0]+end[0])/2,(start[1]+end[1])/2,(start[2]+end[2])/2];
      const model=chain(M4.translation(...center),M4.rotationY(yaw),M4.rotationX(pitch),M4.scale(radius,length/2,radius));
      this.draw(mesh,model,material,emissive);return model;
    }

    drawLeg(root, side, upperAngle, kneeAngle, lateralAngle = 0) {
      const purpleDark=color('#24112f'),boot=color('#160f1c'),skin=color('#d89e8c');
      const hip=chain(root,M4.translation(side*.29,2.08,0),M4.rotationZ(-side*.045+lateralAngle),M4.rotationX(upperAngle));
      this.drawShape(this.meshes.cylinder,hip,[0,-.43,0],[.18,.43,.19],purpleDark);
      this.drawShape(this.meshes.sphere,hip,[0,-.84,0],[.19,.2,.2],purpleDark);
      const knee=chain(hip,M4.translation(0,-.84,0),M4.rotationX(kneeAngle));
      this.drawShape(this.meshes.cylinder,knee,[0,-.39,0],[.155,.39,.16],skin);
      const ankle=M4.point(knee,[0,-.78,0]);
      this.drawShape(this.meshes.box,knee,[0,-.82,-.11],[.2,.21,.34],boot,[.08,0,0]);
      return ankle;
    }

    drawArm(root, side, shoulderAngle, elbowAngle, castRoll = 0) {
      const sleeve=color(side>0?'#54266f':'#49205f'),skin=color('#dba28f');
      const shoulder=chain(root,M4.translation(side*.53,3.32,0),M4.rotationZ(-side*(.13+castRoll)),M4.rotationX(shoulderAngle));
      this.drawShape(this.meshes.sphere,shoulder,[0,-.08,0],[.25,.29,.25],sleeve);
      this.drawShape(this.meshes.cylinder,shoulder,[0,-.37,0],[.16,.37,.17],sleeve);
      const elbow=chain(shoulder,M4.translation(0,-.73,0),M4.rotationX(elbowAngle));
      this.drawShape(this.meshes.sphere,elbow,[0,0,0],[.17,.17,.17],sleeve);
      this.drawShape(this.meshes.cylinder,elbow,[0,-.32,0],[.125,.32,.13],sleeve);
      const handMatrix=chain(elbow,M4.translation(0,-.67,0));
      this.drawShape(this.meshes.sphere,handMatrix,[0,0,0],[.145,.18,.14],skin);
      return handMatrix;
    }

    drawHair(root, sway, lift) {
      const hair=color('#a43126'),highlight=color('#df6941');
      const strands=[[-.31,.18,0],[-.18,.25,.12],[-.04,.28,.18],[.1,.27,.16],[.24,.22,.08],[.34,.12,-.02],[-.38,.05,-.08],[.4,.02,-.1]];
      for(let strand=0;strand<strands.length;strand++){
        const [x,z,phase]=strands[strand], side=Math.sign(x)||1;
        const anchor=chain(root,M4.translation(x,3.94,z+.13),M4.rotationZ(side*(.1+sway*.6)+phase),M4.rotationX(-sway*.3));
        for(let bead=0;bead<4;bead++){
          const curl=Math.sin(bead*1.8+strand)*.045;
          this.drawShape(this.meshes.sphere,anchor,[curl,-bead*.19+lift*.04,bead*.025],[.16-bead*.012,.18,.15],bead%2?highlight:hair);
        }
      }
    }

    drawStaff(handMatrix, cast, spell, time) {
      const hand=M4.point(handMatrix),grip=[hand[0]+.07,hand[1]+.015,hand[2]+.1];
      const restDirection=[.14,.987,.075],castDirection=[.27,.24,-.932];
      const direction=restDirection.map((value,index)=>value+(castDirection[index]-value)*cast);
      const directionLength=Math.hypot(...direction);for(let i=0;i<3;i++)direction[i]/=directionLength;
      const pointOnStaff=distance=>grip.map((value,index)=>value+direction[index]*distance);
      const bottom=pointOnStaff(-1.58),top=pointOnStaff(2.18);
      this.drawSegment(bottom,top,.078,color('#663921'));
      const highlightOffset=[.026,0,.035];
      this.drawSegment(bottom.map((value,index)=>value+highlightOffset[index]),top.map((value,index)=>value+highlightOffset[index]),.018,color('#d09254'));
      this.drawSegment(pointOnStaff(-.3),pointOnStaff(.34),.105,color('#2b1720'));
      for(const distance of [-1.22,-.58,.68,1.34])this.drawShape(this.meshes.sphere,M4.identity(),pointOnStaff(distance),[.092,.075,.092],color('#8b5731'));
      const clawBase=pointOnStaff(2.01),orb=pointOnStaff(2.34);
      this.drawSegment(clawBase,[orb[0]-.19,orb[1]-.05,orb[2]],.043,color('#c49355'));
      this.drawSegment(clawBase,[orb[0]+.19,orb[1]-.05,orb[2]],.043,color('#c49355'));
      const spellColor=spell==='frost'?color('#8beeff',.48):spell==='bubble'?color('#ff91df',.48):color('#a56cff',.48);
      const boltColor=spell==='frost'?color('#d8ffff',.95):spell==='bubble'?color('#ffe2fa',.95):color('#efe5ff',.98);
      const pulse=1+Math.sin(time*.006)*.06;
      this.drawShape(this.meshes.sphere,M4.identity(),orb,[.12,.12,.12],color('#f7ecff',.95),[0,0,0],1.8);
      for(let bolt=0;bolt<3;bolt++){
        const angle=time*.004+bolt*Math.PI*2/3,start=[orb[0]+Math.cos(angle)*.04,orb[1]-.13+bolt*.1,orb[2]+Math.sin(angle)*.04],mid=[orb[0]+Math.cos(angle+1.2)*.11,orb[1]-.03+bolt*.08,orb[2]+Math.sin(angle+1.2)*.11];
        this.drawSegment(start,mid,.018,boltColor,this.meshes.cylinder,1.6);
      }
      this.drawShape(this.meshes.sphere,M4.identity(),orb,[.27*pulse,.27*pulse,.27*pulse],spellColor,[0,0,0],1.35);
      this.drawShape(this.meshes.sphere,M4.identity(),orb,[.36*pulse,.36*pulse,.36*pulse],color('#b277ff',.12),[0,0,0],1.5);
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
      const camera=compact?[0,2.65,8.8]:[0,2.72,8.15], target=[0,2.5,0];
      const projection=M4.perspective((compact?36:34)*Math.PI/180,aspect,.1,40),view=M4.lookAt(camera,target);
      gl.uniformMatrix4fv(this.uniforms.viewProjection,false,M4.multiply(projection,view));gl.uniform3fv(this.uniforms.camera,camera);

      const vertical=(pose.jumpHeight||0)*.72-crouch*.48+Math.abs(step)*this.walkWeight*.035+breath*.012;
      const root=chain(M4.translation(strafe*this.walkWeight*.025,vertical,0),M4.rotationY(-.11-strafe*this.walkWeight*.055),M4.rotationZ(stride*this.walkWeight*.012-strafe*this.walkWeight*.045),M4.rotationX(-crouch*.16-forward*this.walkWeight*.035));
      const leftLeg=stride*this.walkWeight*.52+air*.35+crouch*.62,rightLeg=-stride*this.walkWeight*.52+air*.62+crouch*.62;
      const leftKnee=Math.max(0,-stride)*this.walkWeight*.55+air*.78-crouch*1.12;
      const rightKnee=Math.max(0,stride)*this.walkWeight*.55+air*.95-crouch*1.12;
      const lateralStep=strafe*step*this.walkWeight*.14;
      this.drawLeg(root,-1,leftLeg,leftKnee,lateralStep);this.drawLeg(root,1,rightLeg,rightKnee,-lateralStep);

      const cloakSway=-stride*this.walkWeight*.045-this.hairAngle*.22;
      this.drawShape(this.meshes.cloak,root,[0,2.04-crouch*.08,.03],[.76+crouch*.11,1.1+crouch*.04,.45+crouch*.16],color('#652780'),[cloakSway-crouch*.045,0,0]);
      this.drawShape(this.meshes.sphere,root,[0,3.08,0],[.48,.58+breath*.006,.34],color('#55206f'),[0,0,-stride*this.walkWeight*.018]);

      const leftArmAngle=-stride*this.walkWeight*.42-air*.28-crouch*.12-cast*.22;
      const rightArmAngle=stride*this.walkWeight*.38-air*.14-crouch*.1+cast*1.33;
      const leftHand=this.drawArm(root,-1,leftArmAngle,.12+Math.max(0,stride)*this.walkWeight*.24+air*.2,cast*.1);
      void leftHand;
      const rightHand=this.drawArm(root,1,rightArmAngle,.1+Math.max(0,-stride)*this.walkWeight*.2,cast*.05);

      this.drawShape(this.meshes.sphere,root,[0,3.72,.02],[.43,.48,.4],color('#d45a9f'));
      this.drawShape(this.meshes.sphere,root,[0,3.87,-.03],[.31,.38,.29],color('#dda48f'));
      this.drawShape(this.meshes.box,root,[0,3.55,.07],[.41,.11,.34],color('#bb3e8e'),[.08,0,0]);
      this.drawHair(root,this.hairAngle,air);
      this.drawStaff(rightHand,cast,this.spell,time);
    }
  }

  window.MoonWitch3D=MoonWitch3D;
})();
