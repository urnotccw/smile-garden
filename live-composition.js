// A cached soft mask only behind the mock live comments/actions. It changes
// decoration opacity, never collision positions, and is disabled in clean view.
export class LiveComposition {
  constructor() { this.mask = null; }
  apply(context, width, height, enabled) {
    if (!enabled) return;
    if (!this.mask) {
      this.mask = document.createElement('canvas');
      this.mask.width = 256; this.mask.height = 256;
      const c = this.mask.getContext('2d');
      for (const [x, y, w, h, alpha] of [[.025,.815,.66,.123,.66],[.035,.918,.92,.064,.4]]) {
        const tile = document.createElement('canvas'); tile.width = 256; tile.height = 256;
        const t = tile.getContext('2d');
        const vertical = t.createLinearGradient(0,y*256,0,(y+h)*256);
        vertical.addColorStop(0,'transparent'); vertical.addColorStop(.22,`rgba(0,0,0,${alpha})`);
        vertical.addColorStop(.78,`rgba(0,0,0,${alpha})`); vertical.addColorStop(1,'transparent');
        t.fillStyle=vertical; t.fillRect(x*256,y*256,w*256,h*256);
        t.globalCompositeOperation='destination-in';
        const horizontal=t.createLinearGradient(x*256,0,(x+w)*256,0);
        horizontal.addColorStop(0,'transparent');horizontal.addColorStop(.12,'black');
        horizontal.addColorStop(.8,'black');horizontal.addColorStop(1,'transparent');
        t.fillStyle=horizontal;t.fillRect(0,0,256,256);c.drawImage(tile,0,0);
      }
    }
    context.save();context.globalCompositeOperation='destination-out';context.globalAlpha=1;
    context.drawImage(this.mask,0,0,width,height);context.restore();
  }
}
