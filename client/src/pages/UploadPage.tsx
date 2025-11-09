import { useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractWords } from '../lib/api';
import { filesToBase64Array, validateImageFiles } from '../lib/file';
import { usePracticeStore } from '../store/usePracticeStore';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { MAX_VLM_IMAGES } from '../constants/upload';
import { getErrorMessage } from '../lib/errors';

const UploadPage = () => {
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const images = usePracticeStore((state) => state.images);
  const setWords = usePracticeStore((state) => state.setWords);
  const addImages = usePracticeStore((state) => state.addImages);
  const removeImage = usePracticeStore((state) => state.removeImage);
  const clearImages = usePracticeStore((state) => state.clearImages);
  const navigate = useNavigate();

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setErrors([]);
    const validation = validateImageFiles(fileList, images.length);

    if (validation.errors.length > 0) {
      setErrors(validation.errors);
    }

    if (validation.valid.length > 0) {
      addImages(validation.valid);
    }
  }, [images.length, addImages]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (images.length === 0) {
      setErrors(['请先选择图片']);
      return;
    }
    setErrors([]);
    setLoading(true);
    try {
      const base64List = await filesToBase64Array(images.map((img) => img.file));
      const words = await extractWords(base64List);
      setWords(words);
      clearImages();
      navigate('/practice/confirm');
    } catch (err) {
      setErrors([getErrorMessage(err, '识别失败，请稍后再试')]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-section">
      <div className="panel">
        <h2>上传单词表图片</h2>
        <p className="sub">
          支持手写或打印照片，VLM (google/gemini-2.5-flash-preview-09-2025) 会将识别结果转换为标签列表。您可以上传多张图片来识别更多词汇。
        </p>
        <form className="upload-form" onSubmit={handleSubmit}>
          <div
            className={`dropzone ${dragActive ? 'drag-active' : ''} ${images.length > 0 ? 'has-files' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              onChange={handleChange}
              disabled={loading}
              id="file-upload"
            />
            <div className="dropzone-content">
              {images.length === 0 ? (
                <>
                  <Upload size={48} />
                  <p>拖放或点击上传</p>
                  <p className="hint">支持 PNG/JPEG/WEBP/GIF 格式，最多 {MAX_VLM_IMAGES} 张图片</p>
                </>
              ) : (
                <p className="file-count">{images.length}/{MAX_VLM_IMAGES} 张图片已选择</p>
              )}
            </div>
          </div>

          {images.length > 0 && (
            <div className="image-preview-grid">
              {images.map((image) => (
                <div key={image.id} className="image-preview">
                  <img src={image.preview} alt={image.file.name} />
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removeImage(image.id)}
                    disabled={loading}
                  >
                    <X size={16} />
                  </button>
                  <div className="image-name">{image.file.name}</div>
                </div>
              ))}
              {images.length < MAX_VLM_IMAGES && (
                <label htmlFor="file-upload" className="image-preview add-more">
                  <ImageIcon size={32} />
                  <span>添加更多</span>
                </label>
              )}
            </div>
          )}

          {errors.length > 0 && (
            <div className="form-errors">
              {errors.map((error, index) => (
                <p key={index} className="form-error">{error}</p>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="primary"
            disabled={images.length === 0 || loading}
          >
            {loading ? `AI 正在阅读 ${images.length} 张图片...` : '继续'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UploadPage;
