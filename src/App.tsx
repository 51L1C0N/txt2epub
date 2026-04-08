import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Book, 
  Download, 
  Settings, 
  FileText, 
  CheckCircle, 
  Upload, 
  X, 
  Type, 
  Info
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { generateEpub, EpubOptions, readFileWithEncoding } from '@/src/services/epubService';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [options, setOptions] = useState<EpubOptions>({
    title: '',
    author: 'HanYun',
    convertToTraditional: true,
    koboOptimization: true,
  });

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/plain' && !selectedFile.name.endsWith('.txt')) {
        toast.error('Please upload a .txt file');
        return;
      }
      setFile(selectedFile);
      setOptions(prev => ({ ...prev, title: selectedFile.name.replace(/\.txt$/i, '') }));
      
      try {
        const content = await readFileWithEncoding(selectedFile);
        setFileContent(content);
      } catch (err) {
        toast.error('Failed to read file encoding');
        console.error(err);
      }
    }
  }, []);

  const handleConvert = async () => {
    if (!fileContent) {
      toast.error('No file content found');
      return;
    }

    setIsProcessing(true);
    try {
      const blob = await generateEpub(fileContent, options);
      const extension = options.koboOptimization ? '.kepub.epub' : '.epub';
      saveAs(blob, `${options.title || 'ebook'}${extension}`);
      toast.success('EPUB generated successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate EPUB');
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setFileContent('');
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1C1917] selection:bg-accent selection:text-accent-foreground">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="border-b border-accent/50 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Book className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="font-serif text-xl font-bold tracking-tight">漢韻 txt2epub</h1>
          </div>
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest opacity-60">v2026.04</Badge>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="space-y-12">
          
          <section>
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">01. Upload</h2>
            {!file ? (
              <label className="group relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-accent rounded-2xl cursor-pointer hover:border-primary/50 transition-all bg-white/50 hover:bg-white">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="mb-2 text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground">TXT files only (UTF-8 recommended)</p>
                </div>
                <input type="file" className="hidden" accept=".txt" onChange={onFileChange} />
              </label>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-white border border-accent rounded-2xl flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/5 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={removeFile} className="hover:bg-destructive/10 hover:text-destructive">
                  <X className="w-4 h-4" />
                </Button>
              </motion.div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">02. Metadata & Options</h2>
            <Card className="border-accent bg-white shadow-sm overflow-hidden">
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider opacity-70">Book Title</Label>
                    <Input 
                      id="title" 
                      value={options.title} 
                      onChange={(e) => setOptions(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter book title"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="author" className="text-xs font-semibold uppercase tracking-wider opacity-70">Author</Label>
                    <Input 
                      id="author" 
                      value={options.author} 
                      onChange={(e) => setOptions(prev => ({ ...prev, author: e.target.value }))}
                      placeholder="Enter author name"
                      className="bg-white"
                    />
                  </div>
                </div>

                <Separator className="opacity-50" />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Traditional Chinese Conversion</Label>
                    <p className="text-xs text-muted-foreground">Convert Simplified Chinese to Traditional (TW)</p>
                  </div>
                  <Switch 
                    checked={options.convertToTraditional} 
                    onCheckedChange={(val) => setOptions(prev => ({ ...prev, convertToTraditional: val }))} 
                  />
                </div>

                <Separator className="opacity-50" />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Kobo (KePub) 增強</Label>
                    <p className="text-xs text-muted-foreground">添加語句級別的 span 標籤，支持 Kobo 字典與統計</p>
                  </div>
                  <Switch 
                    checked={options.koboOptimization} 
                    onCheckedChange={(val) => setOptions(prev => ({ ...prev, koboOptimization: val }))} 
                  />
                </div>
              </CardContent>
            </Card>
          </section>

          <Button 
            className="w-full h-14 text-lg font-serif rounded-2xl shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all"
            disabled={!file || isProcessing}
            onClick={handleConvert}
          >
            {isProcessing ? (
              <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="mr-2"
              >
                <Settings className="w-5 h-5" />
              </motion.div>
            ) : (
              <Download className="w-5 h-5 mr-2" />
            )}
            {isProcessing ? 'Generating EPUB...' : 'Generate & Download EPUB'}
          </Button>

          <div className="p-6 bg-accent/30 rounded-2xl border border-accent/50">
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
              <CheckCircle className="w-3 h-3 text-green-600" /> Features
            </h4>
            <ul className="text-xs space-y-2 text-muted-foreground">
              <li>• Fixed Vertical Writing Mode (Traditional Style)</li>
              <li>• Smart chapter detection (Regex-based)</li>
              <li>• Traditional Chinese (TW) conversion (Optional)</li>
              <li>• Pure client-side processing</li>
            </ul>
          </div>

        </div>
      </main>

      <footer className="max-w-3xl mx-auto px-6 py-12 border-t border-accent/50 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-xs text-muted-foreground font-mono">
            &copy; 2026 HanYun txt2epub. Crafted for readers.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">Documentation</a>
            <a href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="text-xs text-muted-foreground hover:text-primary transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
