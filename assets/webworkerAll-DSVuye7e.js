import{E as p,U as Ne,T as ee,k as S,c as he,s as w,F as y,a2 as X,R as j,M as T,w as R,z as fe,$ as G,a0 as pe,b as U,B as v,Y as C,a9 as L,x as D,aa as qe,ab as N,J as I,ac as B,q,t as Qe,G as Ke,ad as H,m as ge,p as me,a4 as xe,a7 as _e,n as Je,o as Ze,a5 as et,a6 as tt,a8 as rt,ae as st,af as it,ag as at,ah as $,ai as nt,aj as ot,D as be,l as ye,ak as z,e as b,al as ut}from"./index-Bydt2iGn.js";import{S as A,c as k,a as lt,b as dt,B as ve}from"./colorToUniform-DmtBy-2V.js";class Te{static init(e){Object.defineProperty(this,"resizeTo",{set(t){globalThis.removeEventListener("resize",this.queueResize),this._resizeTo=t,t&&(globalThis.addEventListener("resize",this.queueResize),this.resize())},get(){return this._resizeTo}}),this.queueResize=()=>{this._resizeTo&&(this._cancelResize(),this._resizeId=requestAnimationFrame(()=>this.resize()))},this._cancelResize=()=>{this._resizeId&&(cancelAnimationFrame(this._resizeId),this._resizeId=null)},this.resize=()=>{if(!this._resizeTo)return;this._cancelResize();let t,r;if(this._resizeTo===globalThis.window)t=globalThis.innerWidth,r=globalThis.innerHeight;else{const{clientWidth:s,clientHeight:a}=this._resizeTo;t=s,r=a}this.renderer.resize(t,r),this.render()},this._resizeId=null,this._resizeTo=null,this.resizeTo=e.resizeTo||null}static destroy(){globalThis.removeEventListener("resize",this.queueResize),this._cancelResize(),this._cancelResize=null,this.queueResize=null,this.resizeTo=null,this.resize=null}}Te.extension=p.Application;class we{static init(e){e=Object.assign({autoStart:!0,sharedTicker:!1},e),Object.defineProperty(this,"ticker",{set(t){this._ticker&&this._ticker.remove(this.render,this),this._ticker=t,t&&t.add(this.render,this,Ne.LOW)},get(){return this._ticker}}),this.stop=()=>{this._ticker.stop()},this.start=()=>{this._ticker.start()},this._ticker=null,this.ticker=e.sharedTicker?ee.shared:new ee,e.autoStart&&this.start()}static destroy(){if(this._ticker){const e=this._ticker;this.ticker=null,e.destroy()}}}we.extension=p.Application;class Pe{constructor(e){this._renderer=e}push(e,t,r){this._renderer.renderPipes.batch.break(r),r.add({renderPipeId:"filter",canBundle:!1,action:"pushFilter",container:t,filterEffect:e})}pop(e,t,r){this._renderer.renderPipes.batch.break(r),r.add({renderPipeId:"filter",action:"popFilter",canBundle:!1})}execute(e){e.action==="pushFilter"?this._renderer.filter.push(e):e.action==="popFilter"&&this._renderer.filter.pop()}destroy(){this._renderer=null}}Pe.extension={type:[p.WebGLPipes,p.WebGPUPipes,p.CanvasPipes],name:"filter"};function ct(i,e){e.clear();const t=e.matrix;for(let r=0;r<i.length;r++){const s=i[r];s.globalDisplayStatus<7||(e.matrix=s.worldTransform,e.addBounds(s.bounds))}return e.matrix=t,e}const ht=new X({attributes:{aPosition:{buffer:new Float32Array([0,0,1,0,1,1,0,1]),format:"float32x2",stride:2*4,offset:0}},indexBuffer:new Uint32Array([0,1,2,0,2,3])});class ft{constructor(){this.skip=!1,this.inputTexture=null,this.backTexture=null,this.filters=null,this.bounds=new fe,this.container=null,this.blendRequired=!1,this.outputRenderSurface=null,this.outputOffset={x:0,y:0},this.globalFrame={x:0,y:0,width:0,height:0}}}class Se{constructor(e){this._filterStackIndex=0,this._filterStack=[],this._filterGlobalUniforms=new S({uInputSize:{value:new Float32Array(4),type:"vec4<f32>"},uInputPixel:{value:new Float32Array(4),type:"vec4<f32>"},uInputClamp:{value:new Float32Array(4),type:"vec4<f32>"},uOutputFrame:{value:new Float32Array(4),type:"vec4<f32>"},uGlobalFrame:{value:new Float32Array(4),type:"vec4<f32>"},uOutputTexture:{value:new Float32Array(4),type:"vec4<f32>"}}),this._globalFilterBindGroup=new he({}),this.renderer=e}get activeBackTexture(){var e;return(e=this._activeFilterData)==null?void 0:e.backTexture}push(e){const t=this.renderer,r=e.filterEffect.filters,s=this._pushFilterData();s.skip=!1,s.filters=r,s.container=e.container,s.outputRenderSurface=t.renderTarget.renderSurface;const a=t.renderTarget.renderTarget.colorTexture.source,n=a.resolution,o=a.antialias;if(r.length===0){s.skip=!0;return}const u=s.bounds;if(e.renderables?ct(e.renderables,u):e.filterEffect.filterArea?(u.clear(),u.addRect(e.filterEffect.filterArea),u.applyMatrix(e.container.worldTransform)):e.container.getFastGlobalBounds(!0,u),e.container){const g=(e.container.renderGroup||e.container.parentRenderGroup).cacheToLocalTransform;g&&u.applyMatrix(g)}if(this._calculateFilterBounds(s,t.renderTarget.rootViewPort,o,n,1),s.skip)return;const d=this._getPreviousFilterData();let h=n,l=0,c=0;d&&(l=d.bounds.minX,c=d.bounds.minY,h=d.inputTexture.source._resolution),s.outputOffset.x=u.minX-l,s.outputOffset.y=u.minY-c;const f=s.globalFrame;if(f.x=l*h,f.y=c*h,f.width=a.width*h,f.height=a.height*h,s.backTexture=w.EMPTY,s.blendRequired){t.renderTarget.finishRenderPass();const x=t.renderTarget.getRenderTarget(s.outputRenderSurface);s.backTexture=this.getBackTexture(x,u,d==null?void 0:d.bounds)}s.inputTexture=y.getOptimalTexture(u.width,u.height,s.resolution,s.antialias),t.renderTarget.bind(s.inputTexture,!0),t.globalUniforms.push({offset:u})}generateFilteredTexture({texture:e,filters:t}){const r=this._pushFilterData();this._activeFilterData=r,r.skip=!1,r.filters=t;const s=e.source,a=s.resolution,n=s.antialias;if(t.length===0)return r.skip=!0,e;const o=r.bounds;if(o.addRect(e.frame),this._calculateFilterBounds(r,o.rectangle,n,a,0),r.skip)return e;const u=a,d=0,h=0;r.outputOffset.x=-o.minX,r.outputOffset.y=-o.minY;const l=r.globalFrame;l.x=d*u,l.y=h*u,l.width=s.width*u,l.height=s.height*u,r.outputRenderSurface=y.getOptimalTexture(o.width,o.height,r.resolution,r.antialias),r.backTexture=w.EMPTY,r.inputTexture=e,this.renderer.renderTarget.finishRenderPass(),this._applyFiltersToTexture(r,!0);const f=r.outputRenderSurface;return f.source.alphaMode="premultiplied-alpha",f}pop(){const e=this.renderer,t=this._popFilterData();t.skip||(e.globalUniforms.pop(),e.renderTarget.finishRenderPass(),this._activeFilterData=t,this._applyFiltersToTexture(t,!1),t.blendRequired&&y.returnTexture(t.backTexture),y.returnTexture(t.inputTexture))}getBackTexture(e,t,r){const s=e.colorTexture.source._resolution,a=y.getOptimalTexture(t.width,t.height,s,!1);let n=t.minX,o=t.minY;r&&(n-=r.minX,o-=r.minY),n=Math.floor(n*s),o=Math.floor(o*s);const u=Math.ceil(t.width*s),d=Math.ceil(t.height*s);return this.renderer.renderTarget.copyToTexture(e,a,{x:n,y:o},{width:u,height:d},{x:0,y:0}),a}applyFilter(e,t,r,s){const a=this.renderer,n=this._activeFilterData,o=n.outputRenderSurface,u=this._filterGlobalUniforms,d=u.uniforms,h=d.uOutputFrame,l=d.uInputSize,c=d.uInputPixel,f=d.uInputClamp,x=d.uGlobalFrame,g=d.uOutputTexture;o===r?(h[0]=n.outputOffset.x,h[1]=n.outputOffset.y):(h[0]=0,h[1]=0),h[2]=t.frame.width,h[3]=t.frame.height,l[0]=t.source.width,l[1]=t.source.height,l[2]=1/l[0],l[3]=1/l[1],c[0]=t.source.pixelWidth,c[1]=t.source.pixelHeight,c[2]=1/c[0],c[3]=1/c[1],f[0]=.5*c[2],f[1]=.5*c[3],f[2]=t.frame.width*l[2]-.5*c[2],f[3]=t.frame.height*l[3]-.5*c[3],x[0]=n.globalFrame.x,x[1]=n.globalFrame.y,x[2]=n.globalFrame.width,x[3]=n.globalFrame.height,r instanceof w&&(r.source.resource=null);const m=this.renderer.renderTarget.getRenderTarget(r);if(a.renderTarget.bind(r,!!s),r instanceof w?(g[0]=r.frame.width,g[1]=r.frame.height):(g[0]=m.width,g[1]=m.height),g[2]=m.isRoot?-1:1,u.update(),a.renderPipes.uniformBatch){const _=a.renderPipes.uniformBatch.getUboResource(u);this._globalFilterBindGroup.setResource(_,0)}else this._globalFilterBindGroup.setResource(u,0);this._globalFilterBindGroup.setResource(t.source,1),this._globalFilterBindGroup.setResource(t.source.style,2),e.groups[0]=this._globalFilterBindGroup,a.encoder.draw({geometry:ht,shader:e,state:e._state,topology:"triangle-list"}),a.type===j.WEBGL&&a.renderTarget.finishRenderPass()}calculateSpriteMatrix(e,t){const r=this._activeFilterData,s=e.set(r.inputTexture._source.width,0,0,r.inputTexture._source.height,r.bounds.minX,r.bounds.minY),a=t.worldTransform.copyTo(T.shared),n=t.renderGroup||t.parentRenderGroup;return n&&n.cacheToLocalTransform&&a.prepend(n.cacheToLocalTransform),a.invert(),s.prepend(a),s.scale(1/t.texture.frame.width,1/t.texture.frame.height),s.translate(t.anchor.x,t.anchor.y),s}destroy(){}_applyFiltersToTexture(e,t){const r=e.inputTexture,s=e.bounds,a=e.filters;if(this._globalFilterBindGroup.setResource(r.source.style,2),this._globalFilterBindGroup.setResource(e.backTexture.source,3),a.length===1)a[0].apply(this,r,e.outputRenderSurface,t);else{let n=e.inputTexture;const o=y.getOptimalTexture(s.width,s.height,n.source._resolution,!1);let u=o,d=0;for(d=0;d<a.length-1;++d){a[d].apply(this,n,u,!0);const l=n;n=u,u=l}a[d].apply(this,n,e.outputRenderSurface,t),y.returnTexture(o)}}_calculateFilterBounds(e,t,r,s,a){var g;const n=this.renderer,o=e.bounds,u=e.filters;let d=1/0,h=0,l=!0,c=!1,f=!1,x=!0;for(let m=0;m<u.length;m++){const _=u[m];if(d=Math.min(d,_.resolution==="inherit"?s:_.resolution),h+=_.padding,_.antialias==="off"?l=!1:_.antialias==="inherit"&&l&&(l=r),_.clipToViewport||(x=!1),!!!(_.compatibleRenderers&n.type)){f=!1;break}if(_.blendRequired&&!(((g=n.backBuffer)==null?void 0:g.useBackBuffer)??!0)){R("Blend filter requires backBuffer on WebGL renderer to be enabled. Set `useBackBuffer: true` in the renderer options."),f=!1;break}f=_.enabled||f,c||(c=_.blendRequired)}if(!f){e.skip=!0;return}if(x&&o.fitBounds(0,t.width/s,0,t.height/s),o.scale(d).ceil().scale(1/d).pad((h|0)*a),!o.isPositive){e.skip=!0;return}e.antialias=l,e.resolution=d,e.blendRequired=c}_popFilterData(){return this._filterStackIndex--,this._filterStack[this._filterStackIndex]}_getPreviousFilterData(){let e,t=this._filterStackIndex-1;for(;t>1&&(t--,e=this._filterStack[t],!!e.skip););return e}_pushFilterData(){let e=this._filterStack[this._filterStackIndex];return e||(e=this._filterStack[this._filterStackIndex]=new ft),this._filterStackIndex++,e}}Se.extension={type:[p.WebGLSystem,p.WebGPUSystem],name:"filter"};const Ce=class Ue extends X{constructor(...e){let t=e[0]??{};t instanceof Float32Array&&(G(pe,"use new MeshGeometry({ positions, uvs, indices }) instead"),t={positions:t,uvs:e[1],indices:e[2]}),t={...Ue.defaultOptions,...t};const r=t.positions||new Float32Array([0,0,1,0,1,1,0,1]);let s=t.uvs;s||(t.positions?s=new Float32Array(r.length):s=new Float32Array([0,0,1,0,1,1,0,1]));const a=t.indices||new Uint32Array([0,1,2,0,2,3]),n=t.shrinkBuffersToFit,o=new U({data:r,label:"attribute-mesh-positions",shrinkToFit:n,usage:v.VERTEX|v.COPY_DST}),u=new U({data:s,label:"attribute-mesh-uvs",shrinkToFit:n,usage:v.VERTEX|v.COPY_DST}),d=new U({data:a,label:"index-mesh-buffer",shrinkToFit:n,usage:v.INDEX|v.COPY_DST});super({attributes:{aPosition:{buffer:o,format:"float32x2",stride:2*4,offset:0},aUV:{buffer:u,format:"float32x2",stride:2*4,offset:0}},indexBuffer:d,topology:t.topology}),this.batchMode="auto"}get positions(){return this.attributes.aPosition.buffer.data}set positions(e){this.attributes.aPosition.buffer.data=e}get uvs(){return this.attributes.aUV.buffer.data}set uvs(e){this.attributes.aUV.buffer.data=e}get indices(){return this.indexBuffer.data}set indices(e){this.indexBuffer.data=e}};Ce.defaultOptions={topology:"triangle-list",shrinkBuffersToFit:!1};let Q=Ce;function pt(i){const e=i._stroke,t=i._fill,s=[`div { ${[`color: ${C.shared.setValue(t.color).toHex()}`,`font-size: ${i.fontSize}px`,`font-family: ${i.fontFamily}`,`font-weight: ${i.fontWeight}`,`font-style: ${i.fontStyle}`,`font-variant: ${i.fontVariant}`,`letter-spacing: ${i.letterSpacing}px`,`text-align: ${i.align}`,`padding: ${i.padding}px`,`white-space: ${i.whiteSpace==="pre"&&i.wordWrap?"pre-wrap":i.whiteSpace}`,...i.lineHeight?[`line-height: ${i.lineHeight}px`]:[],...i.wordWrap?[`word-wrap: ${i.breakWords?"break-all":"break-word"}`,`max-width: ${i.wordWrapWidth}px`]:[],...e?[Me(e)]:[],...i.dropShadow?[Be(i.dropShadow)]:[],...i.cssOverrides].join(";")} }`];return gt(i.tagStyles,s),s.join(" ")}function Be(i){const e=C.shared.setValue(i.color).setAlpha(i.alpha).toHexa(),t=Math.round(Math.cos(i.angle)*i.distance),r=Math.round(Math.sin(i.angle)*i.distance),s=`${t}px ${r}px`;return i.blur>0?`text-shadow: ${s} ${i.blur}px ${e}`:`text-shadow: ${s} ${e}`}function Me(i){return[`-webkit-text-stroke-width: ${i.width}px`,`-webkit-text-stroke-color: ${C.shared.setValue(i.color).toHex()}`,`text-stroke-width: ${i.width}px`,`text-stroke-color: ${C.shared.setValue(i.color).toHex()}`,"paint-order: stroke"].join(";")}const te={fontSize:"font-size: {{VALUE}}px",fontFamily:"font-family: {{VALUE}}",fontWeight:"font-weight: {{VALUE}}",fontStyle:"font-style: {{VALUE}}",fontVariant:"font-variant: {{VALUE}}",letterSpacing:"letter-spacing: {{VALUE}}px",align:"text-align: {{VALUE}}",padding:"padding: {{VALUE}}px",whiteSpace:"white-space: {{VALUE}}",lineHeight:"line-height: {{VALUE}}px",wordWrapWidth:"max-width: {{VALUE}}px"},re={fill:i=>`color: ${C.shared.setValue(i).toHex()}`,breakWords:i=>`word-wrap: ${i?"break-all":"break-word"}`,stroke:Me,dropShadow:Be};function gt(i,e){for(const t in i){const r=i[t],s=[];for(const a in r)re[a]?s.push(re[a](r[a])):te[a]&&s.push(te[a].replace("{{VALUE}}",r[a]));e.push(`${t} { ${s.join(";")} }`)}}class K extends L{constructor(e={}){super(e),this._cssOverrides=[],this.cssOverrides=e.cssOverrides??[],this.tagStyles=e.tagStyles??{}}set cssOverrides(e){this._cssOverrides=e instanceof Array?e:[e],this.update()}get cssOverrides(){return this._cssOverrides}update(){this._cssStyle=null,super.update()}clone(){return new K({align:this.align,breakWords:this.breakWords,dropShadow:this.dropShadow?{...this.dropShadow}:null,fill:this._fill,fontFamily:this.fontFamily,fontSize:this.fontSize,fontStyle:this.fontStyle,fontVariant:this.fontVariant,fontWeight:this.fontWeight,letterSpacing:this.letterSpacing,lineHeight:this.lineHeight,padding:this.padding,stroke:this._stroke,whiteSpace:this.whiteSpace,wordWrap:this.wordWrap,wordWrapWidth:this.wordWrapWidth,cssOverrides:this.cssOverrides,tagStyles:{...this.tagStyles}})}get cssStyle(){return this._cssStyle||(this._cssStyle=pt(this)),this._cssStyle}addOverride(...e){const t=e.filter(r=>!this.cssOverrides.includes(r));t.length>0&&(this.cssOverrides.push(...t),this.update())}removeOverride(...e){const t=e.filter(r=>this.cssOverrides.includes(r));t.length>0&&(this.cssOverrides=this.cssOverrides.filter(r=>!t.includes(r)),this.update())}set fill(e){typeof e!="string"&&typeof e!="number"&&R("[HTMLTextStyle] only color fill is not supported by HTMLText"),super.fill=e}set stroke(e){e&&typeof e!="string"&&typeof e!="number"&&R("[HTMLTextStyle] only color stroke is not supported by HTMLText"),super.stroke=e}}const se="http://www.w3.org/2000/svg",ie="http://www.w3.org/1999/xhtml";class Fe{constructor(){this.svgRoot=document.createElementNS(se,"svg"),this.foreignObject=document.createElementNS(se,"foreignObject"),this.domElement=document.createElementNS(ie,"div"),this.styleElement=document.createElementNS(ie,"style"),this.image=new Image;const{foreignObject:e,svgRoot:t,styleElement:r,domElement:s}=this;e.setAttribute("width","10000"),e.setAttribute("height","10000"),e.style.overflow="hidden",t.appendChild(e),e.appendChild(r),e.appendChild(s)}}let ae;function mt(i,e,t,r){r||(r=ae||(ae=new Fe));const{domElement:s,styleElement:a,svgRoot:n}=r;s.innerHTML=`<style>${e.cssStyle};</style><div style='padding:0'>${i}</div>`,s.setAttribute("style","transform-origin: top left; display: inline-block"),t&&(a.textContent=t),document.body.appendChild(n);const o=s.getBoundingClientRect();n.remove();const u=e.padding*2;return{width:o.width-u,height:o.height-u}}class xt{constructor(){this.batches=[],this.batched=!1}destroy(){this.batches.forEach(e=>{D.return(e)}),this.batches.length=0}}class Re{constructor(e,t){this.state=A.for2d(),this.renderer=e,this._adaptor=t,this.renderer.runners.contextChange.add(this)}contextChange(){this._adaptor.contextChange(this.renderer)}validateRenderable(e){const t=e.context,r=!!e._gpuData,s=this.renderer.graphicsContext.updateGpuContext(t);return!!(s.isBatchable||r!==s.isBatchable)}addRenderable(e,t){const r=this.renderer.graphicsContext.updateGpuContext(e.context);e.didViewUpdate&&this._rebuild(e),r.isBatchable?this._addToBatcher(e,t):(this.renderer.renderPipes.batch.break(t),t.add(e))}updateRenderable(e){const r=this._getGpuDataForRenderable(e).batches;for(let s=0;s<r.length;s++){const a=r[s];a._batcher.updateElement(a)}}execute(e){if(!e.isRenderable)return;const t=this.renderer,r=e.context;if(!t.graphicsContext.getGpuContext(r).batches.length)return;const a=r.customShader||this._adaptor.shader;this.state.blendMode=e.groupBlendMode;const n=a.resources.localUniforms.uniforms;n.uTransformMatrix=e.groupTransform,n.uRound=t._roundPixels|e._roundPixels,k(e.groupColorAlpha,n.uColor,0),this._adaptor.execute(this,e)}_rebuild(e){const t=this._getGpuDataForRenderable(e),r=this.renderer.graphicsContext.updateGpuContext(e.context);t.destroy(),r.isBatchable&&this._updateBatchesForRenderable(e,t)}_addToBatcher(e,t){const r=this.renderer.renderPipes.batch,s=this._getGpuDataForRenderable(e).batches;for(let a=0;a<s.length;a++){const n=s[a];r.addToBatch(n,t)}}_getGpuDataForRenderable(e){return e._gpuData[this.renderer.uid]||this._initGpuDataForRenderable(e)}_initGpuDataForRenderable(e){const t=new xt;return e._gpuData[this.renderer.uid]=t,t}_updateBatchesForRenderable(e,t){const r=e.context,s=this.renderer.graphicsContext.getGpuContext(r),a=this.renderer._roundPixels|e._roundPixels;t.batches=s.batches.map(n=>{const o=D.get(qe);return n.copyTo(o),o.renderable=e,o.roundPixels=a,o})}destroy(){this.renderer=null,this._adaptor.destroy(),this._adaptor=null,this.state=null}}Re.extension={type:[p.WebGLPipes,p.WebGPUPipes,p.CanvasPipes],name:"graphics"};const Ge=class De extends Q{constructor(...e){super({});let t=e[0]??{};typeof t=="number"&&(G(pe,"PlaneGeometry constructor changed please use { width, height, verticesX, verticesY } instead"),t={width:t,height:e[1],verticesX:e[2],verticesY:e[3]}),this.build(t)}build(e){e={...De.defaultOptions,...e},this.verticesX=this.verticesX??e.verticesX,this.verticesY=this.verticesY??e.verticesY,this.width=this.width??e.width,this.height=this.height??e.height;const t=this.verticesX*this.verticesY,r=[],s=[],a=[],n=this.verticesX-1,o=this.verticesY-1,u=this.width/n,d=this.height/o;for(let l=0;l<t;l++){const c=l%this.verticesX,f=l/this.verticesX|0;r.push(c*u,f*d),s.push(c/n,f/o)}const h=n*o;for(let l=0;l<h;l++){const c=l%n,f=l/n|0,x=f*this.verticesX+c,g=f*this.verticesX+c+1,m=(f+1)*this.verticesX+c,_=(f+1)*this.verticesX+c+1;a.push(x,g,m,g,_,m)}this.buffers[0].data=new Float32Array(r),this.buffers[1].data=new Float32Array(s),this.indexBuffer.data=new Uint32Array(a),this.buffers[0].update(),this.buffers[1].update(),this.indexBuffer.update()}};Ge.defaultOptions={width:100,height:100,verticesX:10,verticesY:10};let _t=Ge;class J{constructor(){this.batcherName="default",this.packAsQuad=!1,this.indexOffset=0,this.attributeOffset=0,this.roundPixels=0,this._batcher=null,this._batch=null,this._textureMatrixUpdateId=-1,this._uvUpdateId=-1}get blendMode(){return this.renderable.groupBlendMode}get topology(){return this._topology||this.geometry.topology}set topology(e){this._topology=e}reset(){this.renderable=null,this.texture=null,this._batcher=null,this._batch=null,this.geometry=null,this._uvUpdateId=-1,this._textureMatrixUpdateId=-1}setTexture(e){this.texture!==e&&(this.texture=e,this._textureMatrixUpdateId=-1)}get uvs(){const t=this.geometry.getBuffer("aUV"),r=t.data;let s=r;const a=this.texture.textureMatrix;return a.isSimple||(s=this._transformedUvs,(this._textureMatrixUpdateId!==a._updateID||this._uvUpdateId!==t._updateID)&&((!s||s.length<r.length)&&(s=this._transformedUvs=new Float32Array(r.length)),this._textureMatrixUpdateId=a._updateID,this._uvUpdateId=t._updateID,a.multiplyUvs(r,s))),s}get positions(){return this.geometry.positions}get indices(){return this.geometry.indices}get color(){return this.renderable.groupColorAlpha}get groupTransform(){return this.renderable.groupTransform}get attributeSize(){return this.geometry.positions.length/2}get indexSize(){return this.geometry.indices.length}}class ne{destroy(){}}class Ae{constructor(e,t){this.localUniforms=new S({uTransformMatrix:{value:new T,type:"mat3x3<f32>"},uColor:{value:new Float32Array([1,1,1,1]),type:"vec4<f32>"},uRound:{value:0,type:"f32"}}),this.localUniformsBindGroup=new he({0:this.localUniforms}),this.renderer=e,this._adaptor=t,this._adaptor.init()}validateRenderable(e){const t=this._getMeshData(e),r=t.batched,s=e.batched;if(t.batched=s,r!==s)return!0;if(s){const a=e._geometry;if(a.indices.length!==t.indexSize||a.positions.length!==t.vertexSize)return t.indexSize=a.indices.length,t.vertexSize=a.positions.length,!0;const n=this._getBatchableMesh(e);return n.texture.uid!==e._texture.uid&&(n._textureMatrixUpdateId=-1),!n._batcher.checkAndUpdateTexture(n,e._texture)}return!1}addRenderable(e,t){const r=this.renderer.renderPipes.batch,{batched:s}=this._getMeshData(e);if(s){const a=this._getBatchableMesh(e);a.setTexture(e._texture),a.geometry=e._geometry,r.addToBatch(a,t)}else r.break(t),t.add(e)}updateRenderable(e){if(e.batched){const t=this._getBatchableMesh(e);t.setTexture(e._texture),t.geometry=e._geometry,t._batcher.updateElement(t)}}execute(e){if(!e.isRenderable)return;e.state.blendMode=N(e.groupBlendMode,e.texture._source);const t=this.localUniforms;t.uniforms.uTransformMatrix=e.groupTransform,t.uniforms.uRound=this.renderer._roundPixels|e._roundPixels,t.update(),k(e.groupColorAlpha,t.uniforms.uColor,0),this._adaptor.execute(this,e)}_getMeshData(e){var t,r;return(t=e._gpuData)[r=this.renderer.uid]||(t[r]=new ne),e._gpuData[this.renderer.uid].meshData||this._initMeshData(e)}_initMeshData(e){var t,r;return e._gpuData[this.renderer.uid].meshData={batched:e.batched,indexSize:(t=e._geometry.indices)==null?void 0:t.length,vertexSize:(r=e._geometry.positions)==null?void 0:r.length},e._gpuData[this.renderer.uid].meshData}_getBatchableMesh(e){var t,r;return(t=e._gpuData)[r=this.renderer.uid]||(t[r]=new ne),e._gpuData[this.renderer.uid].batchableMesh||this._initBatchableMesh(e)}_initBatchableMesh(e){const t=new J;return t.renderable=e,t.setTexture(e._texture),t.transform=e.groupTransform,t.roundPixels=this.renderer._roundPixels|e._roundPixels,e._gpuData[this.renderer.uid].batchableMesh=t,t}destroy(){this.localUniforms=null,this.localUniformsBindGroup=null,this._adaptor.destroy(),this._adaptor=null,this.renderer=null}}Ae.extension={type:[p.WebGLPipes,p.WebGPUPipes,p.CanvasPipes],name:"mesh"};class bt{execute(e,t){const r=e.state,s=e.renderer,a=t.shader||e.defaultShader;a.resources.uTexture=t.texture._source,a.resources.uniforms=e.localUniforms;const n=s.gl,o=e.getBuffers(t);s.shader.bind(a),s.state.set(r),s.geometry.bind(o.geometry,a.glProgram);const d=o.geometry.indexBuffer.data.BYTES_PER_ELEMENT===2?n.UNSIGNED_SHORT:n.UNSIGNED_INT;n.drawElements(n.TRIANGLES,t.particleChildren.length*6,d,0)}}class yt{execute(e,t){const r=e.renderer,s=t.shader||e.defaultShader;s.groups[0]=r.renderPipes.uniformBatch.getUniformBindGroup(e.localUniforms,!0),s.groups[1]=r.texture.getTextureBindGroup(t.texture);const a=e.state,n=e.getBuffers(t);r.encoder.draw({geometry:n.geometry,shader:t.shader||e.defaultShader,state:a,size:t.particleChildren.length*6})}}function oe(i,e=null){const t=i*6;if(t>65535?e||(e=new Uint32Array(t)):e||(e=new Uint16Array(t)),e.length!==t)throw new Error(`Out buffer length is incorrect, got ${e.length} and expected ${t}`);for(let r=0,s=0;r<t;r+=6,s+=4)e[r+0]=s+0,e[r+1]=s+1,e[r+2]=s+2,e[r+3]=s+0,e[r+4]=s+2,e[r+5]=s+3;return e}function vt(i){return{dynamicUpdate:ue(i,!0),staticUpdate:ue(i,!1)}}function ue(i,e){const t=[];t.push(`

        var index = 0;

        for (let i = 0; i < ps.length; ++i)
        {
            const p = ps[i];

            `);let r=0;for(const a in i){const n=i[a];if(e!==n.dynamic)continue;t.push(`offset = index + ${r}`),t.push(n.code);const o=I(n.format);r+=o.stride/4}t.push(`
            index += stride * 4;
        }
    `),t.unshift(`
        var stride = ${r};
    `);const s=t.join(`
`);return new Function("ps","f32v","u32v",s)}class Tt{constructor(e){this._size=0,this._generateParticleUpdateCache={};const t=this._size=e.size??1e3,r=e.properties;let s=0,a=0;for(const h in r){const l=r[h],c=I(l.format);l.dynamic?a+=c.stride:s+=c.stride}this._dynamicStride=a/4,this._staticStride=s/4,this.staticAttributeBuffer=new B(t*4*s),this.dynamicAttributeBuffer=new B(t*4*a),this.indexBuffer=oe(t);const n=new X;let o=0,u=0;this._staticBuffer=new U({data:new Float32Array(1),label:"static-particle-buffer",shrinkToFit:!1,usage:v.VERTEX|v.COPY_DST}),this._dynamicBuffer=new U({data:new Float32Array(1),label:"dynamic-particle-buffer",shrinkToFit:!1,usage:v.VERTEX|v.COPY_DST});for(const h in r){const l=r[h],c=I(l.format);l.dynamic?(n.addAttribute(l.attributeName,{buffer:this._dynamicBuffer,stride:this._dynamicStride*4,offset:o*4,format:l.format}),o+=c.size):(n.addAttribute(l.attributeName,{buffer:this._staticBuffer,stride:this._staticStride*4,offset:u*4,format:l.format}),u+=c.size)}n.addIndex(this.indexBuffer);const d=this.getParticleUpdate(r);this._dynamicUpload=d.dynamicUpdate,this._staticUpload=d.staticUpdate,this.geometry=n}getParticleUpdate(e){const t=wt(e);return this._generateParticleUpdateCache[t]?this._generateParticleUpdateCache[t]:(this._generateParticleUpdateCache[t]=this.generateParticleUpdate(e),this._generateParticleUpdateCache[t])}generateParticleUpdate(e){return vt(e)}update(e,t){e.length>this._size&&(t=!0,this._size=Math.max(e.length,this._size*1.5|0),this.staticAttributeBuffer=new B(this._size*this._staticStride*4*4),this.dynamicAttributeBuffer=new B(this._size*this._dynamicStride*4*4),this.indexBuffer=oe(this._size),this.geometry.indexBuffer.setDataWithSize(this.indexBuffer,this.indexBuffer.byteLength,!0));const r=this.dynamicAttributeBuffer;if(this._dynamicUpload(e,r.float32View,r.uint32View),this._dynamicBuffer.setDataWithSize(this.dynamicAttributeBuffer.float32View,e.length*this._dynamicStride*4,!0),t){const s=this.staticAttributeBuffer;this._staticUpload(e,s.float32View,s.uint32View),this._staticBuffer.setDataWithSize(s.float32View,e.length*this._staticStride*4,!0)}}destroy(){this._staticBuffer.destroy(),this._dynamicBuffer.destroy(),this.geometry.destroy()}}function wt(i){const e=[];for(const t in i){const r=i[t];e.push(t,r.code,r.dynamic?"d":"s")}return e.join("_")}var Pt=`varying vec2 vUV;
varying vec4 vColor;

uniform sampler2D uTexture;

void main(void){
    vec4 color = texture2D(uTexture, vUV) * vColor;
    gl_FragColor = color;
}`,St=`attribute vec2 aVertex;
attribute vec2 aUV;
attribute vec4 aColor;

attribute vec2 aPosition;
attribute float aRotation;

uniform mat3 uTranslationMatrix;
uniform float uRound;
uniform vec2 uResolution;
uniform vec4 uColor;

varying vec2 vUV;
varying vec4 vColor;

vec2 roundPixels(vec2 position, vec2 targetSize)
{       
    return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;
}

void main(void){
    float cosRotation = cos(aRotation);
    float sinRotation = sin(aRotation);
    float x = aVertex.x * cosRotation - aVertex.y * sinRotation;
    float y = aVertex.x * sinRotation + aVertex.y * cosRotation;

    vec2 v = vec2(x, y);
    v = v + aPosition;

    gl_Position = vec4((uTranslationMatrix * vec3(v, 1.0)).xy, 0.0, 1.0);

    if(uRound == 1.0)
    {
        gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
    }

    vUV = aUV;
    vColor = vec4(aColor.rgb * aColor.a, aColor.a) * uColor;
}
`,le=`
struct ParticleUniforms {
  uProjectionMatrix:mat3x3<f32>,
  uColor:vec4<f32>,
  uResolution:vec2<f32>,
  uRoundPixels:f32,
};

@group(0) @binding(0) var<uniform> uniforms: ParticleUniforms;

@group(1) @binding(0) var uTexture: texture_2d<f32>;
@group(1) @binding(1) var uSampler : sampler;

struct VSOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv : vec2<f32>,
    @location(1) color : vec4<f32>,
  };
@vertex
fn mainVertex(
  @location(0) aVertex: vec2<f32>,
  @location(1) aPosition: vec2<f32>,
  @location(2) aUV: vec2<f32>,
  @location(3) aColor: vec4<f32>,
  @location(4) aRotation: f32,
) -> VSOutput {
  
   let v = vec2(
       aVertex.x * cos(aRotation) - aVertex.y * sin(aRotation),
       aVertex.x * sin(aRotation) + aVertex.y * cos(aRotation)
   ) + aPosition;

   let position = vec4((uniforms.uProjectionMatrix * vec3(v, 1.0)).xy, 0.0, 1.0);

    let vColor = vec4(aColor.rgb * aColor.a, aColor.a) * uniforms.uColor;

  return VSOutput(
   position,
   aUV,
   vColor,
  );
}

@fragment
fn mainFragment(
  @location(0) uv: vec2<f32>,
  @location(1) color: vec4<f32>,
  @builtin(position) position: vec4<f32>,
) -> @location(0) vec4<f32> {

    var sample = textureSample(uTexture, uSampler, uv) * color;
   
    return sample;
}`;class Ct extends q{constructor(){const e=Qe.from({vertex:St,fragment:Pt}),t=Ke.from({fragment:{source:le,entryPoint:"mainFragment"},vertex:{source:le,entryPoint:"mainVertex"}});super({glProgram:e,gpuProgram:t,resources:{uTexture:w.WHITE.source,uSampler:new H({}),uniforms:{uTranslationMatrix:{value:new T,type:"mat3x3<f32>"},uColor:{value:new C(16777215),type:"vec4<f32>"},uRound:{value:1,type:"f32"},uResolution:{value:[0,0],type:"vec2<f32>"}}}})}}class ke{constructor(e,t){this.state=A.for2d(),this.localUniforms=new S({uTranslationMatrix:{value:new T,type:"mat3x3<f32>"},uColor:{value:new Float32Array(4),type:"vec4<f32>"},uRound:{value:1,type:"f32"},uResolution:{value:[0,0],type:"vec2<f32>"}}),this.renderer=e,this.adaptor=t,this.defaultShader=new Ct,this.state=A.for2d()}validateRenderable(e){return!1}addRenderable(e,t){this.renderer.renderPipes.batch.break(t),t.add(e)}getBuffers(e){return e._gpuData[this.renderer.uid]||this._initBuffer(e)}_initBuffer(e){return e._gpuData[this.renderer.uid]=new Tt({size:e.particleChildren.length,properties:e._properties}),e._gpuData[this.renderer.uid]}updateRenderable(e){}execute(e){const t=e.particleChildren;if(t.length===0)return;const r=this.renderer,s=this.getBuffers(e);e.texture||(e.texture=t[0].texture);const a=this.state;s.update(t,e._childrenDirty),e._childrenDirty=!1,a.blendMode=N(e.blendMode,e.texture._source);const n=this.localUniforms.uniforms,o=n.uTranslationMatrix;e.worldTransform.copyTo(o),o.prepend(r.globalUniforms.globalUniformData.projectionMatrix),n.uResolution=r.globalUniforms.globalUniformData.resolution,n.uRound=r._roundPixels|e._roundPixels,k(e.groupColorAlpha,n.uColor,0),this.adaptor.execute(this,e)}destroy(){this.defaultShader&&(this.defaultShader.destroy(),this.defaultShader=null)}}class ze extends ke{constructor(e){super(e,new bt)}}ze.extension={type:[p.WebGLPipes],name:"particle"};class Oe extends ke{constructor(e){super(e,new yt)}}Oe.extension={type:[p.WebGPUPipes],name:"particle"};const Ve=class We extends _t{constructor(e={}){e={...We.defaultOptions,...e},super({width:e.width,height:e.height,verticesX:4,verticesY:4}),this.update(e)}update(e){var t,r;this.width=e.width??this.width,this.height=e.height??this.height,this._originalWidth=e.originalWidth??this._originalWidth,this._originalHeight=e.originalHeight??this._originalHeight,this._leftWidth=e.leftWidth??this._leftWidth,this._rightWidth=e.rightWidth??this._rightWidth,this._topHeight=e.topHeight??this._topHeight,this._bottomHeight=e.bottomHeight??this._bottomHeight,this._anchorX=(t=e.anchor)==null?void 0:t.x,this._anchorY=(r=e.anchor)==null?void 0:r.y,this.updateUvs(),this.updatePositions()}updatePositions(){const e=this.positions,{width:t,height:r,_leftWidth:s,_rightWidth:a,_topHeight:n,_bottomHeight:o,_anchorX:u,_anchorY:d}=this,h=s+a,l=t>h?1:t/h,c=n+o,f=r>c?1:r/c,x=Math.min(l,f),g=u*t,m=d*r;e[0]=e[8]=e[16]=e[24]=-g,e[2]=e[10]=e[18]=e[26]=s*x-g,e[4]=e[12]=e[20]=e[28]=t-a*x-g,e[6]=e[14]=e[22]=e[30]=t-g,e[1]=e[3]=e[5]=e[7]=-m,e[9]=e[11]=e[13]=e[15]=n*x-m,e[17]=e[19]=e[21]=e[23]=r-o*x-m,e[25]=e[27]=e[29]=e[31]=r-m,this.getBuffer("aPosition").update()}updateUvs(){const e=this.uvs;e[0]=e[8]=e[16]=e[24]=0,e[1]=e[3]=e[5]=e[7]=0,e[6]=e[14]=e[22]=e[30]=1,e[25]=e[27]=e[29]=e[31]=1;const t=1/this._originalWidth,r=1/this._originalHeight;e[2]=e[10]=e[18]=e[26]=t*this._leftWidth,e[9]=e[11]=e[13]=e[15]=r*this._topHeight,e[4]=e[12]=e[20]=e[28]=1-t*this._rightWidth,e[17]=e[19]=e[21]=e[23]=1-r*this._bottomHeight,this.getBuffer("aUV").update()}};Ve.defaultOptions={width:100,height:100,leftWidth:10,topHeight:10,rightWidth:10,bottomHeight:10,originalWidth:100,originalHeight:100};let Ut=Ve;class Bt extends J{constructor(){super(),this.geometry=new Ut}destroy(){this.geometry.destroy()}}class Ee{constructor(e){this._renderer=e}addRenderable(e,t){const r=this._getGpuSprite(e);e.didViewUpdate&&this._updateBatchableSprite(e,r),this._renderer.renderPipes.batch.addToBatch(r,t)}updateRenderable(e){const t=this._getGpuSprite(e);e.didViewUpdate&&this._updateBatchableSprite(e,t),t._batcher.updateElement(t)}validateRenderable(e){const t=this._getGpuSprite(e);return!t._batcher.checkAndUpdateTexture(t,e._texture)}_updateBatchableSprite(e,t){t.geometry.update(e),t.setTexture(e._texture)}_getGpuSprite(e){return e._gpuData[this._renderer.uid]||this._initGPUSprite(e)}_initGPUSprite(e){const t=e._gpuData[this._renderer.uid]=new Bt,r=t;return r.renderable=e,r.transform=e.groupTransform,r.texture=e._texture,r.roundPixels=this._renderer._roundPixels|e._roundPixels,e.didViewUpdate||this._updateBatchableSprite(e,r),t}destroy(){this._renderer=null}}Ee.extension={type:[p.WebGLPipes,p.WebGPUPipes,p.CanvasPipes],name:"nineSliceSprite"};const Mt={name:"tiling-bit",vertex:{header:`
            struct TilingUniforms {
                uMapCoord:mat3x3<f32>,
                uClampFrame:vec4<f32>,
                uClampOffset:vec2<f32>,
                uTextureTransform:mat3x3<f32>,
                uSizeAnchor:vec4<f32>
            };

            @group(2) @binding(0) var<uniform> tilingUniforms: TilingUniforms;
            @group(2) @binding(1) var uTexture: texture_2d<f32>;
            @group(2) @binding(2) var uSampler: sampler;
        `,main:`
            uv = (tilingUniforms.uTextureTransform * vec3(uv, 1.0)).xy;

            position = (position - tilingUniforms.uSizeAnchor.zw) * tilingUniforms.uSizeAnchor.xy;
        `},fragment:{header:`
            struct TilingUniforms {
                uMapCoord:mat3x3<f32>,
                uClampFrame:vec4<f32>,
                uClampOffset:vec2<f32>,
                uTextureTransform:mat3x3<f32>,
                uSizeAnchor:vec4<f32>
            };

            @group(2) @binding(0) var<uniform> tilingUniforms: TilingUniforms;
            @group(2) @binding(1) var uTexture: texture_2d<f32>;
            @group(2) @binding(2) var uSampler: sampler;
        `,main:`

            var coord = vUV + ceil(tilingUniforms.uClampOffset - vUV);
            coord = (tilingUniforms.uMapCoord * vec3(coord, 1.0)).xy;
            var unclamped = coord;
            coord = clamp(coord, tilingUniforms.uClampFrame.xy, tilingUniforms.uClampFrame.zw);

            var bias = 0.;

            if(unclamped.x == coord.x && unclamped.y == coord.y)
            {
                bias = -32.;
            }

            outColor = textureSampleBias(uTexture, uSampler, coord, bias);
        `}},Ft={name:"tiling-bit",vertex:{header:`
            uniform mat3 uTextureTransform;
            uniform vec4 uSizeAnchor;

        `,main:`
            uv = (uTextureTransform * vec3(aUV, 1.0)).xy;

            position = (position - uSizeAnchor.zw) * uSizeAnchor.xy;
        `},fragment:{header:`
            uniform sampler2D uTexture;
            uniform mat3 uMapCoord;
            uniform vec4 uClampFrame;
            uniform vec2 uClampOffset;
        `,main:`

        vec2 coord = vUV + ceil(uClampOffset - vUV);
        coord = (uMapCoord * vec3(coord, 1.0)).xy;
        vec2 unclamped = coord;
        coord = clamp(coord, uClampFrame.xy, uClampFrame.zw);

        outColor = texture(uTexture, coord, unclamped == coord ? 0.0 : -32.0);// lod-bias very negative to force lod 0

        `}};let O,V;class Rt extends q{constructor(){O??(O=ge({name:"tiling-sprite-shader",bits:[lt,Mt,me]})),V??(V=xe({name:"tiling-sprite-shader",bits:[dt,Ft,_e]}));const e=new S({uMapCoord:{value:new T,type:"mat3x3<f32>"},uClampFrame:{value:new Float32Array([0,0,1,1]),type:"vec4<f32>"},uClampOffset:{value:new Float32Array([0,0]),type:"vec2<f32>"},uTextureTransform:{value:new T,type:"mat3x3<f32>"},uSizeAnchor:{value:new Float32Array([100,100,.5,.5]),type:"vec4<f32>"}});super({glProgram:V,gpuProgram:O,resources:{localUniforms:new S({uTransformMatrix:{value:new T,type:"mat3x3<f32>"},uColor:{value:new Float32Array([1,1,1,1]),type:"vec4<f32>"},uRound:{value:0,type:"f32"}}),tilingUniforms:e,uTexture:w.EMPTY.source,uSampler:w.EMPTY.source.style}})}updateUniforms(e,t,r,s,a,n){const o=this.resources.tilingUniforms,u=n.width,d=n.height,h=n.textureMatrix,l=o.uniforms.uTextureTransform;l.set(r.a*u/e,r.b*u/t,r.c*d/e,r.d*d/t,r.tx/e,r.ty/t),l.invert(),o.uniforms.uMapCoord=h.mapCoord,o.uniforms.uClampFrame=h.uClampFrame,o.uniforms.uClampOffset=h.uClampOffset,o.uniforms.uTextureTransform=l,o.uniforms.uSizeAnchor[0]=e,o.uniforms.uSizeAnchor[1]=t,o.uniforms.uSizeAnchor[2]=s,o.uniforms.uSizeAnchor[3]=a,n&&(this.resources.uTexture=n.source,this.resources.uSampler=n.source.style)}}class Gt extends Q{constructor(){super({positions:new Float32Array([0,0,1,0,1,1,0,1]),uvs:new Float32Array([0,0,1,0,1,1,0,1]),indices:new Uint32Array([0,1,2,0,2,3])})}}function Dt(i,e){const t=i.anchor.x,r=i.anchor.y;e[0]=-t*i.width,e[1]=-r*i.height,e[2]=(1-t)*i.width,e[3]=-r*i.height,e[4]=(1-t)*i.width,e[5]=(1-r)*i.height,e[6]=-t*i.width,e[7]=(1-r)*i.height}function At(i,e,t,r){let s=0;const a=i.length/e,n=r.a,o=r.b,u=r.c,d=r.d,h=r.tx,l=r.ty;for(t*=e;s<a;){const c=i[t],f=i[t+1];i[t]=n*c+u*f+h,i[t+1]=o*c+d*f+l,t+=e,s++}}function kt(i,e){const t=i.texture,r=t.frame.width,s=t.frame.height;let a=0,n=0;i.applyAnchorToTexture&&(a=i.anchor.x,n=i.anchor.y),e[0]=e[6]=-a,e[2]=e[4]=1-a,e[1]=e[3]=-n,e[5]=e[7]=1-n;const o=T.shared;o.copyFrom(i._tileTransform.matrix),o.tx/=i.width,o.ty/=i.height,o.invert(),o.scale(i.width/r,i.height/s),At(e,2,0,o)}const F=new Gt;class zt{constructor(){this.canBatch=!0,this.geometry=new Q({indices:F.indices.slice(),positions:F.positions.slice(),uvs:F.uvs.slice()})}destroy(){var e;this.geometry.destroy(),(e=this.shader)==null||e.destroy()}}class Le{constructor(e){this._state=A.default2d,this._renderer=e}validateRenderable(e){const t=this._getTilingSpriteData(e),r=t.canBatch;this._updateCanBatch(e);const s=t.canBatch;if(s&&s===r){const{batchableMesh:a}=t;return!a._batcher.checkAndUpdateTexture(a,e.texture)}return r!==s}addRenderable(e,t){const r=this._renderer.renderPipes.batch;this._updateCanBatch(e);const s=this._getTilingSpriteData(e),{geometry:a,canBatch:n}=s;if(n){s.batchableMesh||(s.batchableMesh=new J);const o=s.batchableMesh;e.didViewUpdate&&(this._updateBatchableMesh(e),o.geometry=a,o.renderable=e,o.transform=e.groupTransform,o.setTexture(e._texture)),o.roundPixels=this._renderer._roundPixels|e._roundPixels,r.addToBatch(o,t)}else r.break(t),s.shader||(s.shader=new Rt),this.updateRenderable(e),t.add(e)}execute(e){const{shader:t}=this._getTilingSpriteData(e);t.groups[0]=this._renderer.globalUniforms.bindGroup;const r=t.resources.localUniforms.uniforms;r.uTransformMatrix=e.groupTransform,r.uRound=this._renderer._roundPixels|e._roundPixels,k(e.groupColorAlpha,r.uColor,0),this._state.blendMode=N(e.groupBlendMode,e.texture._source),this._renderer.encoder.draw({geometry:F,shader:t,state:this._state})}updateRenderable(e){const t=this._getTilingSpriteData(e),{canBatch:r}=t;if(r){const{batchableMesh:s}=t;e.didViewUpdate&&this._updateBatchableMesh(e),s._batcher.updateElement(s)}else if(e.didViewUpdate){const{shader:s}=t;s.updateUniforms(e.width,e.height,e._tileTransform.matrix,e.anchor.x,e.anchor.y,e.texture)}}_getTilingSpriteData(e){return e._gpuData[this._renderer.uid]||this._initTilingSpriteData(e)}_initTilingSpriteData(e){const t=new zt;return t.renderable=e,e._gpuData[this._renderer.uid]=t,t}_updateBatchableMesh(e){const t=this._getTilingSpriteData(e),{geometry:r}=t,s=e.texture.source.style;s.addressMode!=="repeat"&&(s.addressMode="repeat",s.update()),kt(e,r.uvs),Dt(e,r.positions)}destroy(){this._renderer=null}_updateCanBatch(e){const t=this._getTilingSpriteData(e),r=e.texture;let s=!0;return this._renderer.type===j.WEBGL&&(s=this._renderer.context.supports.nonPowOf2wrapping),t.canBatch=r.textureMatrix.isSimple&&(s||r.source.isPowerOfTwo),t.canBatch}}Le.extension={type:[p.WebGLPipes,p.WebGPUPipes,p.CanvasPipes],name:"tilingSprite"};const Ot={name:"local-uniform-msdf-bit",vertex:{header:`
            struct LocalUniforms {
                uColor:vec4<f32>,
                uTransformMatrix:mat3x3<f32>,
                uDistance: f32,
                uRound:f32,
            }

            @group(2) @binding(0) var<uniform> localUniforms : LocalUniforms;
        `,main:`
            vColor *= localUniforms.uColor;
            modelMatrix *= localUniforms.uTransformMatrix;
        `,end:`
            if(localUniforms.uRound == 1)
            {
                vPosition = vec4(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);
            }
        `},fragment:{header:`
            struct LocalUniforms {
                uColor:vec4<f32>,
                uTransformMatrix:mat3x3<f32>,
                uDistance: f32
            }

            @group(2) @binding(0) var<uniform> localUniforms : LocalUniforms;
         `,main:`
            outColor = vec4<f32>(calculateMSDFAlpha(outColor, localUniforms.uColor, localUniforms.uDistance));
        `}},Vt={name:"local-uniform-msdf-bit",vertex:{header:`
            uniform mat3 uTransformMatrix;
            uniform vec4 uColor;
            uniform float uRound;
        `,main:`
            vColor *= uColor;
            modelMatrix *= uTransformMatrix;
        `,end:`
            if(uRound == 1.)
            {
                gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
            }
        `},fragment:{header:`
            uniform float uDistance;
         `,main:`
            outColor = vec4(calculateMSDFAlpha(outColor, vColor, uDistance));
        `}},Wt={name:"msdf-bit",fragment:{header:`
            fn calculateMSDFAlpha(msdfColor:vec4<f32>, shapeColor:vec4<f32>, distance:f32) -> f32 {

                // MSDF
                var median = msdfColor.r + msdfColor.g + msdfColor.b -
                    min(msdfColor.r, min(msdfColor.g, msdfColor.b)) -
                    max(msdfColor.r, max(msdfColor.g, msdfColor.b));

                // SDF
                median = min(median, msdfColor.a);

                var screenPxDistance = distance * (median - 0.5);
                var alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);
                if (median < 0.01) {
                    alpha = 0.0;
                } else if (median > 0.99) {
                    alpha = 1.0;
                }

                // Gamma correction for coverage-like alpha
                var luma: f32 = dot(shapeColor.rgb, vec3<f32>(0.299, 0.587, 0.114));
                var gamma: f32 = mix(1.0, 1.0 / 2.2, luma);
                var coverage: f32 = pow(shapeColor.a * alpha, gamma);

                return coverage;

            }
        `}},Et={name:"msdf-bit",fragment:{header:`
            float calculateMSDFAlpha(vec4 msdfColor, vec4 shapeColor, float distance) {

                // MSDF
                float median = msdfColor.r + msdfColor.g + msdfColor.b -
                                min(msdfColor.r, min(msdfColor.g, msdfColor.b)) -
                                max(msdfColor.r, max(msdfColor.g, msdfColor.b));

                // SDF
                median = min(median, msdfColor.a);

                float screenPxDistance = distance * (median - 0.5);
                float alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);

                if (median < 0.01) {
                    alpha = 0.0;
                } else if (median > 0.99) {
                    alpha = 1.0;
                }

                // Gamma correction for coverage-like alpha
                float luma = dot(shapeColor.rgb, vec3(0.299, 0.587, 0.114));
                float gamma = mix(1.0, 1.0 / 2.2, luma);
                float coverage = pow(shapeColor.a * alpha, gamma);

                return coverage;
            }
        `}};let W,E;class Lt extends q{constructor(e){const t=new S({uColor:{value:new Float32Array([1,1,1,1]),type:"vec4<f32>"},uTransformMatrix:{value:new T,type:"mat3x3<f32>"},uDistance:{value:4,type:"f32"},uRound:{value:0,type:"f32"}});W??(W=ge({name:"sdf-shader",bits:[Je,Ze(e),Ot,Wt,me]})),E??(E=xe({name:"sdf-shader",bits:[et,tt(e),Vt,Et,_e]})),super({glProgram:E,gpuProgram:W,resources:{localUniforms:t,batchSamplers:rt(e)}})}}class It extends nt{destroy(){this.context.customShader&&this.context.customShader.destroy(),super.destroy()}}class Ie{constructor(e){this._renderer=e,this._renderer.renderableGC.addManagedHash(this,"_gpuBitmapText")}validateRenderable(e){const t=this._getGpuBitmapText(e);return e._didTextUpdate&&(e._didTextUpdate=!1,this._updateContext(e,t)),this._renderer.renderPipes.graphics.validateRenderable(t)}addRenderable(e,t){const r=this._getGpuBitmapText(e);de(e,r),e._didTextUpdate&&(e._didTextUpdate=!1,this._updateContext(e,r)),this._renderer.renderPipes.graphics.addRenderable(r,t),r.context.customShader&&this._updateDistanceField(e)}updateRenderable(e){const t=this._getGpuBitmapText(e);de(e,t),this._renderer.renderPipes.graphics.updateRenderable(t),t.context.customShader&&this._updateDistanceField(e)}_updateContext(e,t){const{context:r}=t,s=st.getFont(e.text,e._style);r.clear(),s.distanceField.type!=="none"&&(r.customShader||(r.customShader=new Lt(this._renderer.limits.maxBatchableTextures)));const a=it.graphemeSegmenter(e.text),n=e._style;let o=s.baseLineOffset;const u=at(a,n,s,!0);let d=0;const h=n.padding,l=u.scale;let c=u.width,f=u.height+u.offsetY;n._stroke&&(c+=n._stroke.width/l,f+=n._stroke.width/l),r.translate(-e._anchor._x*c-h,-e._anchor._y*f-h).scale(l,l);const x=s.applyFillAsTint?n._fill.color:16777215;for(let g=0;g<u.lines.length;g++){const m=u.lines[g];for(let _=0;_<m.charPositions.length;_++){const Z=a[d++],P=s.chars[Z];P!=null&&P.texture&&r.texture(P.texture,x||"black",Math.round(m.charPositions[_]+P.xOffset),Math.round(o+P.yOffset))}o+=s.lineHeight}}_getGpuBitmapText(e){return e._gpuData[this._renderer.uid]||this.initGpuText(e)}initGpuText(e){const t=new It;return e._gpuData[this._renderer.uid]=t,this._updateContext(e,t),t}_updateDistanceField(e){const t=this._getGpuBitmapText(e).context,r=e._style.fontFamily,s=$.get(`${r}-bitmap`),{a,b:n,c:o,d:u}=e.groupTransform,d=Math.sqrt(a*a+n*n),h=Math.sqrt(o*o+u*u),l=(Math.abs(d)+Math.abs(h))/2,c=s.baseRenderedFontSize/e._style.fontSize,f=l*s.distanceField.range*(1/c);t.customShader.resources.localUniforms.uniforms.uDistance=f}destroy(){this._renderer=null}}Ie.extension={type:[p.WebGLPipes,p.WebGPUPipes,p.CanvasPipes],name:"bitmapText"};function de(i,e){e.groupTransform=i.groupTransform,e.groupColorAlpha=i.groupColorAlpha,e.groupColor=i.groupColor,e.groupBlendMode=i.groupBlendMode,e.globalDisplayStatus=i.globalDisplayStatus,e.groupTransform=i.groupTransform,e.localDisplayStatus=i.localDisplayStatus,e.groupAlpha=i.groupAlpha,e._roundPixels=i._roundPixels}class Ht extends ve{constructor(e){super(),this.generatingTexture=!1,this._renderer=e,e.runners.resolutionChange.add(this)}resolutionChange(){const e=this.renderable;e._autoResolution&&e.onViewUpdate()}destroy(){this._renderer.htmlText.returnTexturePromise(this.texturePromise),this.texturePromise=null,this._renderer=null}}function Y(i,e){const{texture:t,bounds:r}=i;ot(r,e._anchor,t);const s=e._style._getFinalPadding();r.minX-=s,r.minY-=s,r.maxX-=s,r.maxY-=s}class He{constructor(e){this._renderer=e}validateRenderable(e){return e._didTextUpdate}addRenderable(e,t){const r=this._getGpuText(e);e._didTextUpdate&&(this._updateGpuText(e).catch(s=>{console.error(s)}),e._didTextUpdate=!1,Y(r,e)),this._renderer.renderPipes.batch.addToBatch(r,t)}updateRenderable(e){const t=this._getGpuText(e);t._batcher.updateElement(t)}async _updateGpuText(e){e._didTextUpdate=!1;const t=this._getGpuText(e);if(t.generatingTexture)return;t.texturePromise&&(this._renderer.htmlText.returnTexturePromise(t.texturePromise),t.texturePromise=null),t.generatingTexture=!0,e._resolution=e._autoResolution?this._renderer.resolution:e.resolution;const r=this._renderer.htmlText.getTexturePromise(e);t.texturePromise=r,t.texture=await r;const s=e.renderGroup||e.parentRenderGroup;s&&(s.structureDidChange=!0),t.generatingTexture=!1,Y(t,e)}_getGpuText(e){return e._gpuData[this._renderer.uid]||this.initGpuText(e)}initGpuText(e){const t=new Ht(this._renderer);return t.renderable=e,t.transform=e.groupTransform,t.texture=w.EMPTY,t.bounds={minX:0,maxX:1,minY:0,maxY:0},t.roundPixels=this._renderer._roundPixels|e._roundPixels,e._resolution=e._autoResolution?this._renderer.resolution:e.resolution,e._gpuData[this._renderer.uid]=t,t}destroy(){this._renderer=null}}He.extension={type:[p.WebGLPipes,p.WebGPUPipes,p.CanvasPipes],name:"htmlText"};function $t(){const{userAgent:i}=be.get().getNavigator();return/^((?!chrome|android).)*safari/i.test(i)}const Yt=new fe;function $e(i,e,t,r){const s=Yt;s.minX=0,s.minY=0,s.maxX=i.width/r|0,s.maxY=i.height/r|0;const a=y.getOptimalTexture(s.width,s.height,r,!1);return a.source.uploadMethodId="image",a.source.resource=i,a.source.alphaMode="premultiply-alpha-on-upload",a.frame.width=e/r,a.frame.height=t/r,a.source.emit("update",a.source),a.updateUvs(),a}function Xt(i,e){const t=e.fontFamily,r=[],s={},a=/font-family:([^;"\s]+)/g,n=i.match(a);function o(u){s[u]||(r.push(u),s[u]=!0)}if(Array.isArray(t))for(let u=0;u<t.length;u++)o(t[u]);else o(t);n&&n.forEach(u=>{const d=u.split(":")[1].trim();o(d)});for(const u in e.tagStyles){const d=e.tagStyles[u].fontFamily;o(d)}return r}async function jt(i){const t=await(await be.get().fetch(i)).blob(),r=new FileReader;return await new Promise((a,n)=>{r.onloadend=()=>a(r.result),r.onerror=n,r.readAsDataURL(t)})}async function ce(i,e){const t=await jt(e);return`@font-face {
        font-family: "${i.fontFamily}";
        src: url('${t}');
        font-weight: ${i.fontWeight};
        font-style: ${i.fontStyle};
    }`}const M=new Map;async function Nt(i,e,t){const r=i.filter(s=>$.has(`${s}-and-url`)).map((s,a)=>{if(!M.has(s)){const{url:n}=$.get(`${s}-and-url`);a===0?M.set(s,ce({fontWeight:e.fontWeight,fontStyle:e.fontStyle,fontFamily:s},n)):M.set(s,ce({fontWeight:t.fontWeight,fontStyle:t.fontStyle,fontFamily:s},n))}return M.get(s)});return(await Promise.all(r)).join(`
`)}function qt(i,e,t,r,s){const{domElement:a,styleElement:n,svgRoot:o}=s;a.innerHTML=`<style>${e.cssStyle}</style><div style='padding:0;'>${i}</div>`,a.setAttribute("style",`transform: scale(${t});transform-origin: top left; display: inline-block`),n.textContent=r;const{width:u,height:d}=s.image;return o.setAttribute("width",u.toString()),o.setAttribute("height",d.toString()),new XMLSerializer().serializeToString(o)}function Qt(i,e){const t=ye.getOptimalCanvasAndContext(i.width,i.height,e),{context:r}=t;return r.clearRect(0,0,i.width,i.height),r.drawImage(i,0,0),t}function Kt(i,e,t){return new Promise(async r=>{t&&await new Promise(s=>setTimeout(s,100)),i.onload=()=>{r()},i.src=`data:image/svg+xml;charset=utf8,${encodeURIComponent(e)}`,i.crossOrigin="anonymous"})}class Ye{constructor(e){this._renderer=e,this._createCanvas=e.type===j.WEBGPU}getTexture(e){return this.getTexturePromise(e)}getTexturePromise(e){return this._buildTexturePromise(e)}async _buildTexturePromise(e){const{text:t,style:r,resolution:s,textureStyle:a}=e,n=D.get(Fe),o=Xt(t,r),u=await Nt(o,r,K.defaultTextStyle),d=mt(t,r,u,n),h=Math.ceil(Math.ceil(Math.max(1,d.width)+r.padding*2)*s),l=Math.ceil(Math.ceil(Math.max(1,d.height)+r.padding*2)*s),c=n.image,f=2;c.width=(h|0)+f,c.height=(l|0)+f;const x=qt(t,r,s,u,n);await Kt(c,x,$t()&&o.length>0);const g=c;let m;this._createCanvas&&(m=Qt(c,s));const _=$e(m?m.canvas:g,c.width-f,c.height-f,s);return a&&(_.source.style=a),this._createCanvas&&(this._renderer.texture.initSource(_.source),ye.returnCanvasAndContext(m)),D.return(n),_}returnTexturePromise(e){e.then(t=>{this._cleanUp(t)}).catch(()=>{R("HTMLTextSystem: Failed to clean texture")})}_cleanUp(e){y.returnTexture(e,!0),e.source.resource=null,e.source.uploadMethodId="unknown"}destroy(){this._renderer=null}}Ye.extension={type:[p.WebGLSystem,p.WebGPUSystem,p.CanvasSystem],name:"htmlText"};class Jt extends ve{constructor(e){super(),this._renderer=e,e.runners.resolutionChange.add(this)}resolutionChange(){const e=this.renderable;e._autoResolution&&e.onViewUpdate()}destroy(){this._renderer.canvasText.returnTexture(this.texture),this._renderer=null}}class Xe{constructor(e){this._renderer=e}validateRenderable(e){return e._didTextUpdate}addRenderable(e,t){const r=this._getGpuText(e);e._didTextUpdate&&(this._updateGpuText(e),e._didTextUpdate=!1),this._renderer.renderPipes.batch.addToBatch(r,t)}updateRenderable(e){const t=this._getGpuText(e);t._batcher.updateElement(t)}_updateGpuText(e){const t=this._getGpuText(e);t.texture&&this._renderer.canvasText.returnTexture(t.texture),e._resolution=e._autoResolution?this._renderer.resolution:e.resolution,t.texture=t.texture=this._renderer.canvasText.getTexture(e),Y(t,e)}_getGpuText(e){return e._gpuData[this._renderer.uid]||this.initGpuText(e)}initGpuText(e){const t=new Jt(this._renderer);return t.renderable=e,t.transform=e.groupTransform,t.bounds={minX:0,maxX:1,minY:0,maxY:0},t.roundPixels=this._renderer._roundPixels|e._roundPixels,e._gpuData[this._renderer.uid]=t,t}destroy(){this._renderer=null}}Xe.extension={type:[p.WebGLPipes,p.WebGPUPipes,p.CanvasPipes],name:"text"};class je{constructor(e){this._renderer=e}getTexture(e,t,r,s){typeof e=="string"&&(G("8.0.0","CanvasTextSystem.getTexture: Use object TextOptions instead of separate arguments"),e={text:e,style:r,resolution:t}),e.style instanceof L||(e.style=new L(e.style)),e.textureStyle instanceof H||(e.textureStyle=new H(e.textureStyle)),typeof e.text!="string"&&(e.text=e.text.toString());const{text:a,style:n,textureStyle:o}=e,u=e.resolution??this._renderer.resolution,{frame:d,canvasAndContext:h}=z.getCanvasAndContext({text:a,style:n,resolution:u}),l=$e(h.canvas,d.width,d.height,u);if(o&&(l.source.style=o),n.trim&&(d.pad(n.padding),l.frame.copyFrom(d),l.updateUvs()),n.filters){const c=this._applyFilters(l,n.filters);return this.returnTexture(l),z.returnCanvasAndContext(h),c}return this._renderer.texture.initSource(l._source),z.returnCanvasAndContext(h),l}returnTexture(e){const t=e.source;t.resource=null,t.uploadMethodId="unknown",t.alphaMode="no-premultiply-alpha",y.returnTexture(e,!0)}renderTextToCanvas(){G("8.10.0","CanvasTextSystem.renderTextToCanvas: no longer supported, use CanvasTextSystem.getTexture instead")}_applyFilters(e,t){const r=this._renderer.renderTarget.renderTarget,s=this._renderer.filter.generateFilteredTexture({texture:e,filters:t});return this._renderer.renderTarget.bind(r,!1),s}destroy(){this._renderer=null}}je.extension={type:[p.WebGLSystem,p.WebGPUSystem,p.CanvasSystem],name:"canvasText"};b.add(Te);b.add(we);b.add(Re);b.add(ut);b.add(Ae);b.add(ze);b.add(Oe);b.add(je);b.add(Xe);b.add(Ie);b.add(Ye);b.add(He);b.add(Le);b.add(Ee);b.add(Se);b.add(Pe);
