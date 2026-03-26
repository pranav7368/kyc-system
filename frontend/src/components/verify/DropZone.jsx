import { useDropzone } from 'react-dropzone'
import { UploadCloud, FileImage, X, CheckCircle } from 'lucide-react'
import clsx from 'clsx'

const MAX_SIZE = 10 * 1024 * 1024  // 10MB

export default function DropZone({ label, file, onFile, hint = '' }) {
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxSize: MAX_SIZE,
    multiple: false,
    onDropAccepted: ([f]) => onFile(f),
  })

  const preview = file ? URL.createObjectURL(file) : null
  const rejection = fileRejections[0]?.errors[0]?.message

  return (
    <div className="space-y-2">
      <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">{label}</p>

      {file ? (
        <div className="relative rounded-xl overflow-hidden border border-accent-primary/30 bg-bg-secondary">
          <img src={preview} alt="preview" className="w-full h-48 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-accent-primary" />
              <span className="text-xs text-white truncate max-w-[150px]">{file.name}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onFile(null) }}
              className="p-1 rounded-full bg-white/10 hover:bg-red-500/30 text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="absolute top-2 right-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary font-mono">
              {(file.size / 1024).toFixed(0)} KB
            </span>
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={clsx(
            'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed h-48 cursor-pointer transition-all duration-200',
            isDragActive
              ? 'border-accent-primary bg-accent-primary/10 shadow-[0_0_20px_rgba(6,214,160,0.15)]'
              : 'border-white/[0.12] bg-bg-secondary hover:border-accent-primary/50 hover:bg-accent-primary/5'
          )}
        >
          <input {...getInputProps()} />
          <div className={clsx(
            'w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors',
            isDragActive ? 'bg-accent-primary/20' : 'bg-white/[0.05]'
          )}>
            {isDragActive
              ? <UploadCloud className="w-6 h-6 text-accent-primary animate-bounce" />
              : <FileImage className="w-6 h-6 text-gray-500" />
            }
          </div>
          <p className="text-sm text-gray-300 font-medium">
            {isDragActive ? 'Drop it!' : 'Drag & drop or click to upload'}
          </p>
          <p className="text-xs text-gray-500 mt-1">{hint || 'JPG, PNG, WebP — max 10MB'}</p>
          {rejection && (
            <p className="text-xs text-rose-400 mt-2">{rejection}</p>
          )}
        </div>
      )}
    </div>
  )
}
