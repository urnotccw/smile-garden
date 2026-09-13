// Physics/tracking always advance. Painting can sleep only after the final
// empty frame clears the old image; new content wakes on the very next frame.
export class LayerActivity {
  constructor() { this.visible = Object.create(null); }
  needsPaint(layer, visible) {
    const dirty = !!visible || !!this.visible[layer];
    this.visible[layer] = !!visible;
    return dirty;
  }
}
