/** 画像の読み込みを待つ（読み込めなかった画像も、待つのを終える） */
class ImageLoader {
  loadedImages = new Map<string, boolean>();
  callbacks: Array<() => void> = [];

  /** ページの画像をまとめて登録する */
  registerImages(images: string[]): void {
    for (const src of images) this.registerImage(src);
  }

  registerImage(src: string): void {
    if (this.loadedImages.has(src)) return;
    this.loadedImages.set(src, false);

    const img = new Image();
    img.onload = () => {
      this.loadedImages.set(src, true);
      this.checkAllLoaded();
    };
    img.onerror = () => {
      console.error(`画像を読み込めませんでした: ${src}`);
      // エラーでも読み込み完了とみなす
      this.loadedImages.set(src, true);
      this.checkAllLoaded();
    };
    img.src = src;
  }

  checkAllLoaded(): void {
    const allLoaded = Array.from(this.loadedImages.values()).every((loaded) => loaded);
    if (allLoaded && this.callbacks.length > 0) {
      // コールバック実行（実行中に加わったコールバックは捨てずに、次の機会まで残す）
      const callbacks = this.callbacks;
      this.callbacks = [];
      for (const callback of callbacks) callback();
    }
  }

  onAllLoaded(callback: () => void): void {
    if (this.loadedImages.size === 0 || Array.from(this.loadedImages.values()).every((loaded) => loaded)) {
      // 画像が登録されていないか、すべて読み込み済みの場合は即時実行
      callback();
    } else {
      this.callbacks.push(callback);
    }
  }
}

// シングルトンインスタンスを作成
const imageLoader = new ImageLoader();
export default imageLoader;
