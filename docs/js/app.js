// Frame - brutalist.systems
class FrameEditor {
  static config = {
    aspectRatios: {
      '1:1': { width: 1080, height: 1080, name: 'square', label: '1:1 Square', category: null },
      '3:2': { width: 1080, height: 720, name: 'photo', label: '3:2 (1.5:1) 35mm', category: 'Horizontal' },
      '16:9': { width: 1080, height: 608, name: 'wide', label: '16:9 (1.78:1) Widescreen', category: 'Horizontal' },
      '4:3': { width: 1080, height: 810, name: 'classic', label: '4:3 (1.33:1) Standard', category: 'Horizontal' },
      '4:5': { width: 1080, height: 1350, name: 'portrait', label: '4:5 (0.8:1) Instagram Portrait', category: 'Vertical' },
      '9:16': { width: 1080, height: 1920, name: 'vertical', label: '9:16 (0.5625:1) Portrait', category: 'Vertical' },
      '2:3': { width: 1080, height: 1620, name: 'photo-portrait', label: '2:3 Photo - 4x6 Print', category: 'Vertical' }
    },
    border: {
      min: 0,
      max: 200,
      default: 0,
      step: 5,
      presets: [0, 20, 50, 100, 150, 200]
    },
    background: {
      types: { color: 'Color', blur: 'Blur' },
      defaultType: 'color',
      defaultColor: '#000000'
    },
    blur: {
      min: 5,
      max: 200,
      default: 30,
      step: 5
    },
    maxDimension: 4096
  };

  constructor() {
    this.initializeDOM();
    this.initializeState();
    this.initializeCanvas();
    this.initializeControls();
    this.loadSettings();
    this.attachEventListeners();
  }

  initializeDOM() {
    this.fileInput = document.getElementById('file-input');
    this.dropZone = document.getElementById('drop-zone');
    this.dropText = document.getElementById('drop-text');
    this.optionsArea = document.getElementById('options-area');
    this.previewArea = document.getElementById('preview-area');
    this.canvas = document.getElementById('preview-canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.downloadBtn = document.getElementById('download-btn');
    this.copyBtn = document.getElementById('copy-btn');
    this.downloadAllBtn = document.getElementById('download-all-btn');
    this.aspectRatioSelect = document.getElementById('aspect-ratio');
    this.borderSlider = document.getElementById('border-slider');
    this.borderValue = document.getElementById('border-value');
    this.bgTypeSelect = document.getElementById('bg-type');
    this.bgColor = document.getElementById('bg-color');
    this.blurAmount = document.getElementById('blur-amount');
    this.colorControl = document.getElementById('color-control');
    this.blurControl = document.getElementById('blur-control');
    this.prevBtn = document.getElementById('prev-btn');
    this.nextBtn = document.getElementById('next-btn');
    this.currentNum = document.getElementById('current-num');
    this.totalNum = document.getElementById('total-num');
    this.imageCaption = document.getElementById('image-caption');
    this.presetButtonsContainer = document.querySelector('.preset-buttons');
  }

  initializeState() {
    this.images = [];
    this.currentIndex = 0;
    this.heicCache = new Map();
  }

  initializeCanvas() {
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  initializeControls() {
    this.populateAspectRatios();
    this.populateBorderPresets();
    this.populateBackgroundTypes();
    this.setDefaultValues();
  }

  setDefaultValues() {
    const { border, background, blur } = FrameEditor.config;
    this.borderSlider.min = border.min;
    this.borderSlider.max = border.max;
    this.borderSlider.value = border.default;
    this.borderSlider.step = border.step;
    this.borderValue.textContent = border.default;
    this.bgColor.value = background.defaultColor;
    this.blurAmount.min = blur.min;
    this.blurAmount.max = blur.max;
    this.blurAmount.value = blur.default;
    this.blurAmount.step = blur.step;
    this.bgTypeSelect.value = background.defaultType;
  }

  populateAspectRatios() {
    const buildOption = (key, { label }) => `<option value="${key}">${label}</option>`;
    const buildGroup = (category, options) =>
      `<optgroup label="${category}">${options.map(o => buildOption(o.key, o)).join('')}</optgroup>`;

    const categories = { Horizontal: [], Vertical: [] };
    const uncategorized = [];

    Object.entries(FrameEditor.config.aspectRatios).forEach(([key, value]) => {
      const option = { key, ...value };
      value.category ? categories[value.category].push(option) : uncategorized.push(option);
    });

    const html = [
      ...uncategorized.map(o => buildOption(o.key, o)),
      ...Object.entries(categories)
        .filter(([_, options]) => options.length > 0)
        .map(([category, options]) => buildGroup(category, options))
    ].join('');

    this.aspectRatioSelect.innerHTML = html;
  }

  populateBorderPresets() {
    this.presetButtonsContainer.innerHTML = FrameEditor.config.border.presets
      .map(value => `<button class="preset-btn" data-border="${value}">${value}px</button>`)
      .join('');
  }

  populateBackgroundTypes() {
    this.bgTypeSelect.innerHTML = Object.entries(FrameEditor.config.background.types)
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join('');
  }

  attachEventListeners() {
    this.optionsArea.addEventListener('submit', e => e.preventDefault());

    // File upload
    this.dropZone.addEventListener('click', () => this.fileInput.click());
    this.dropZone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.fileInput.click();
      }
    });
    this.fileInput.addEventListener('change', async e => {
      await this.handleFiles(Array.from(e.target.files));
      this.fileInput.value = '';
    });

    // Drag and drop
    this.dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      this.dropZone.classList.add('drag-over');
    });
    this.dropZone.addEventListener('dragleave', () => this.dropZone.classList.remove('drag-over'));
    this.dropZone.addEventListener('drop', async e => {
      e.preventDefault();
      this.dropZone.classList.remove('drag-over');
      await this.handleFiles(Array.from(e.dataTransfer.files));
    });

    // Controls
    this.aspectRatioSelect.addEventListener('change', () => this.updateAndRender());
    this.borderSlider.addEventListener('input', () => {
      this.borderValue.textContent = this.borderSlider.value;
      this.updatePresetButtons();
      this.updateAndRender();
    });

    // Border presets
    this.presetButtonsContainer.addEventListener('click', e => {
      const btn = e.target.closest('.preset-btn');
      if (!btn) return;
      this.borderSlider.value = btn.dataset.border;
      this.borderValue.textContent = btn.dataset.border;
      this.updatePresetButtons();
      this.updateAndRender();
    });

    // Background controls
    this.bgTypeSelect.addEventListener('change', () => {
      const isBlur = this.bgTypeSelect.value === 'blur';
      this.colorControl.classList.toggle('hidden', isBlur);
      this.blurControl.classList.toggle('hidden', !isBlur);
      this.updateAndRender();
    });
    this.bgColor.addEventListener('input', () => this.updateAndRender());
    this.blurAmount.addEventListener('input', () => this.updateAndRender());

    // Navigation
    this.prevBtn.addEventListener('click', () => this.navigateTo(this.currentIndex - 1));
    this.nextBtn.addEventListener('click', () => this.navigateTo(this.currentIndex + 1));

    // Actions
    this.downloadBtn.addEventListener('click', () => this.downloadCurrent());
    this.copyBtn.addEventListener('click', () => this.copyToClipboard());
    this.downloadAllBtn.addEventListener('click', () => this.downloadAll());

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.target.matches('input, select')) return;
      if (this.images.length === 0 && e.key !== 'Escape') return;

      const actions = {
        ArrowLeft: () => !this.prevBtn.disabled && this.prevBtn.click(),
        ArrowRight: () => !this.nextBtn.disabled && this.nextBtn.click(),
        ' ': () => { e.preventDefault(); this.downloadBtn.click(); },
        Enter: () => { e.preventDefault(); this.downloadBtn.click(); },
        Escape: () => this.clearAll()
      };

      actions[e.key]?.();
    });
  }

  async handleFiles(files) {
    this.dropText.classList.add('processing');

    const processFile = async file => {
      if (this.isHEIC(file)) {
        try {
          const converted = await this.convertHEIC(file);
          converted.originalName = file.name;
          return this.loadImage(converted);
        } catch (err) {
          console.error('HEIC conversion failed:', err);
        }
      }
      return this.loadImage(file);
    };

    this.images = await Promise.all(files.map(processFile));
    this.currentIndex = 0;
    this.dropText.classList.remove('processing');
    this.updateUI();
    this.renderPreview();
  }

  isHEIC(file) {
    const ext = file.name.toLowerCase();
    return ext.endsWith('.heic') || ext.endsWith('.heif');
  }

  async convertHEIC(file) {
    const cacheKey = `${file.name}_${file.size}`;
    if (this.heicCache.has(cacheKey)) {
      return this.heicCache.get(cacheKey);
    }

    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.95 });
    const converted = new File(
      [blob],
      file.name.replace(/\.heic$/i, '.jpg'),
      { type: 'image/jpeg' }
    );
    this.heicCache.set(cacheKey, converted);
    return converted;
  }

  loadImage(file) {
    return new Promise((resolve, reject) => {
      const objectURL = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        // NOTE: At this point, the image is loaded and we can revoke the
        // original object URL to free up some memory. The image objects
        // still hold the decoded data after the URL has been revoked.
        URL.revokeObjectURL(objectURL);
        resolve({
          img,
          file,
          originalName: file.originalName || file.name
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectURL);
        reject(new Error('Failed to load image'));
      };

      img.src = objectURL;
    });
  }

  updateUI() {
    const hasImages = this.images.length > 0;

    if (hasImages) {
      const plural = this.images.length > 1 ? 's' : '';
      this.dropText.textContent = `${this.images.length} image${plural} loaded`;
      this.dropZone.classList.add('compact');
      this.optionsArea.classList.remove('hidden');
      this.previewArea.classList.remove('hidden');
      this.totalNum.textContent = this.images.length;
      this.currentNum.textContent = this.currentIndex + 1;
      this.prevBtn.disabled = this.currentIndex === 0;
      this.nextBtn.disabled = this.currentIndex === this.images.length - 1;
      this.downloadAllBtn.classList.toggle('hidden', this.images.length === 1);
      this.updateImageCaption();
    } else {
      this.dropText.textContent = 'Drag & drop images or click to select';
      this.dropZone.classList.remove('compact');
      this.optionsArea.classList.add('hidden');
      this.previewArea.classList.add('hidden');
    }
  }

  updateImageCaption() {
    if (!this.hasImages()) return;
    const { img, originalName } = this.images[this.currentIndex];
    const { width, height } = this.calculateOutputDimensions(img);
    this.imageCaption.textContent = `${originalName} · ${img.width}×${img.height}px → ${width}×${height}px`;
  }

  updatePresetButtons() {
    const currentBorder = this.borderSlider.value;
    this.presetButtonsContainer.querySelectorAll('.preset-btn').forEach(btn => {
      btn.style.fontWeight = btn.dataset.border === currentBorder ? 'bold' : 'normal';
    });
  }

  updateAndRender() {
    this.saveSettings();
    this.renderPreview();
  }

  navigateTo(index) {
    this.currentIndex = index;
    this.updateUI();
    this.renderPreview();
  }

  clearAll() {
    this.images = [];
    this.currentIndex = 0;
    this.heicCache.clear();
    this.updateUI();
    this.canvas.classList.add('hidden');
  }

  hasImages() {
    return this.images.length > 0;
  }

  calculateOutputDimensions(img) {
    const [ratioW, ratioH] = this.aspectRatioSelect.value.split(':').map(Number);
    const targetRatio = ratioW / ratioH;
    const baseDimension = Math.min(
      Math.max(img.width, img.height),
      FrameEditor.config.maxDimension
    );

    let width, height;
    if (targetRatio >= 1) {
      width = baseDimension;
      height = Math.round(width / targetRatio);
    } else {
      height = baseDimension;
      width = Math.round(height * targetRatio);
    }

    // Clamp to max dimension
    const maxDim = FrameEditor.config.maxDimension;
    if (width > maxDim) {
      width = maxDim;
      height = Math.round(width / targetRatio);
    }
    if (height > maxDim) {
      height = maxDim;
      width = Math.round(height * targetRatio);
    }

    return { width, height };
  }

  renderPreview() {
    if (!this.hasImages()) return;

    const { img } = this.images[this.currentIndex];
    const border = parseInt(this.borderSlider.value, 10) || 0;
    const { width, height } = this.calculateOutputDimensions(img);

    this.canvas.width = width;
    this.canvas.height = height;

    // Draw background
    if (this.bgTypeSelect.value === 'blur') {
      const blurAmount = parseInt(this.blurAmount.value, 10) || 15;
      this.drawBlurredBackground(img, blurAmount);
    } else {
      this.ctx.fillStyle = this.bgColor.value;
      this.ctx.fillRect(0, 0, width, height);
    }

    // Draw centered image with border
    const availableWidth = width - border * 2;
    const availableHeight = height - border * 2;
    const scale = Math.min(availableWidth / img.width, availableHeight / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (width - w) / 2;
    const y = (height - h) / 2;

    this.ctx.drawImage(img, x, y, w, h);
    this.canvas.classList.remove('hidden');
    this.updateImageCaption();
  }

  drawBlurredBackground(img, blurPx) {
    const scale = Math.max(this.canvas.width / img.width, this.canvas.height / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (this.canvas.width - w) / 2;
    const y = (this.canvas.height - h) / 2;

    // Create temp canvas to draw and blur the background
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw the scaled image
    tempCtx.drawImage(img, x, y, w, h);

    // Apply StackBlur (works on all browsers including Safari/iOS)
    StackBlur.canvasRGBA(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, blurPx);

    // Draw the blurred result onto main canvas
    this.ctx.drawImage(tempCanvas, 0, 0);
  }

  downloadCanvasBlob(filename) {
    return new Promise(resolve => {
      this.canvas.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        resolve();
      }, 'image/png');
    });
  }

  getFilename(imageIndex = this.currentIndex) {
    const { originalName } = this.images[imageIndex];
    const baseName = originalName.replace(/\.[^.]+$/, '');
    const ratioName = FrameEditor.config.aspectRatios[this.aspectRatioSelect.value].name;
    return `${baseName}_${ratioName}.png`;
  }

  downloadCurrent() {
    if (!this.hasImages()) return;
    this.downloadCanvasBlob(this.getFilename());
  }

  async copyToClipboard() {
    if (!this.hasImages()) return;

    try {
      this.canvas.toBlob(async blob => {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);

        const originalText = this.copyBtn.textContent;
        this.copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          this.copyBtn.textContent = originalText;
        }, 1500);
      }, 'image/png');
    } catch (err) {
      console.error('Copy failed:', err);
      alert('Copy to clipboard not supported');
    }
  }

  async downloadAll() {
    if (!this.hasImages()) return;

    const originalText = this.downloadAllBtn.textContent;
    this.downloadAllBtn.textContent = 'Creating ZIP...';
    this.downloadAllBtn.disabled = true;

    const zip = new JSZip();
    const originalIndex = this.currentIndex;

    for (let i = 0; i < this.images.length; i++) {
      this.navigateTo(i);
      await new Promise(resolve => setTimeout(resolve, 100));

      const blob = await new Promise(resolve => {
        this.canvas.toBlob(resolve, 'image/png');
      });

      zip.file(this.getFilename(i), blob);
    }

    this.downloadAllBtn.textContent = 'Generating ZIP...';
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = 'frame_export.zip';
    a.click();
    URL.revokeObjectURL(a.href);

    this.navigateTo(originalIndex);
    this.downloadAllBtn.textContent = originalText;
    this.downloadAllBtn.disabled = false;
  }

  saveSettings() {
    localStorage.setItem('frame_settings', JSON.stringify({
      ratio: this.aspectRatioSelect.value,
      border: this.borderSlider.value,
      bgType: this.bgTypeSelect.value,
      bgColor: this.bgColor.value,
      blurAmount: this.blurAmount.value
    }));
  }

  loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('frame_settings'));
      if (!saved) return;

      this.aspectRatioSelect.value = saved.ratio || '1:1';
      this.borderSlider.value = saved.border || 0;
      this.borderValue.textContent = this.borderSlider.value;
      this.bgTypeSelect.value = saved.bgType || 'color';
      this.bgColor.value = saved.bgColor || '#000000';
      this.blurAmount.value = saved.blurAmount || 15;

      const isBlur = this.bgTypeSelect.value === 'blur';
      this.colorControl.classList.toggle('hidden', isBlur);
      this.blurControl.classList.toggle('hidden', !isBlur);

      this.updatePresetButtons();
    } catch (e) {
      // Silently ignore localStorage errors
    }
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new FrameEditor();
});
