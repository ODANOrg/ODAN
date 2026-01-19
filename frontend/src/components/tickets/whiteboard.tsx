'use client';

import { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Square, Circle, Minus, Type, Eraser, Trash2, Undo, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { sendWhiteboardAction, getSocket } from '@/lib/socket';

interface WhiteboardProps {
  onSave: (imageUrl: string) => void;
  ticketId: string;
}

const colors = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
];

type Tool = 'pencil' | 'line' | 'rectangle' | 'circle' | 'text' | 'eraser';

export function Whiteboard({ onSave, ticketId }: WhiteboardProps) {
  const t = useTranslations();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    canvas.style.width = `${canvas.offsetWidth}px`;
    canvas.style.height = `${canvas.offsetHeight}px`;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.scale(2, 2);
    context.lineCap = 'round';
    context.strokeStyle = color;
    context.lineWidth = strokeWidth;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    contextRef.current = context;

    // Save initial state
    setHistory([context.getImageData(0, 0, canvas.width, canvas.height)]);

    // Listen for remote whiteboard actions
    const socket = getSocket();
    socket.on('whiteboard:action', (data: any) => {
      if (data.ticketId === ticketId && contextRef.current) {
        // Replay the action
        const ctx = contextRef.current;
        ctx.strokeStyle = data.color;
        ctx.lineWidth = data.strokeWidth;
        
        if (data.type === 'stroke') {
          ctx.beginPath();
          data.points.forEach((point: [number, number], i: number) => {
            if (i === 0) ctx.moveTo(point[0], point[1]);
            else ctx.lineTo(point[0], point[1]);
          });
          ctx.stroke();
        }
      }
    });

    return () => {
      socket.off('whiteboard:action');
    };
  }, [ticketId, color, strokeWidth]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      contextRef.current.lineWidth = tool === 'eraser' ? strokeWidth * 3 : strokeWidth;
    }
  }, [color, strokeWidth, tool]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !contextRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === 'pencil' || tool === 'eraser') {
      contextRef.current.lineTo(x, y);
      contextRef.current.stroke();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing || !contextRef.current || !canvasRef.current) return;
    
    contextRef.current.closePath();
    setIsDrawing(false);

    // Save to history
    const imageData = contextRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHistory((prev) => [...prev, imageData]);
  };

  const undo = () => {
    if (history.length <= 1 || !contextRef.current) return;
    
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    contextRef.current.putImageData(newHistory[newHistory.length - 1], 0, 0);
  };

  const clearCanvas = () => {
    if (!contextRef.current || !canvasRef.current) return;
    
    contextRef.current.fillStyle = '#ffffff';
    contextRef.current.fillRect(0, 0, canvasRef.current.width / 2, canvasRef.current.height / 2);
    
    const imageData = contextRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHistory([imageData]);
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  const tools: { id: Tool; icon: React.ElementType; label: string }[] = [
    { id: 'pencil', icon: Pencil, label: t('whiteboard.tools.pencil') },
    { id: 'line', icon: Minus, label: t('whiteboard.tools.line') },
    { id: 'rectangle', icon: Square, label: t('whiteboard.tools.rectangle') },
    { id: 'circle', icon: Circle, label: t('whiteboard.tools.circle') },
    { id: 'text', icon: Type, label: t('whiteboard.tools.text') },
    { id: 'eraser', icon: Eraser, label: t('whiteboard.tools.eraser') },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 p-2 border-b">
        <div className="flex gap-1">
          {tools.map((t) => (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={tool === t.id ? 'default' : 'ghost'}
                  size="icon"
                  onClick={() => setTool(t.id)}
                >
                  <t.icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Colors */}
        <div className="flex gap-1">
          {colors.map((c) => (
            <button
              key={c}
              className={cn(
                'w-6 h-6 rounded-full border-2',
                color === c ? 'border-primary' : 'border-transparent'
              )}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Stroke width */}
        <div className="flex items-center gap-2 w-32">
          <span className="text-xs text-muted-foreground">{strokeWidth}px</span>
          <Slider
            value={[strokeWidth]}
            onValueChange={([v]) => setStrokeWidth(v)}
            min={1}
            max={20}
            step={1}
          />
        </div>

        <div className="flex-1" />

        <Button variant="ghost" size="icon" onClick={undo} disabled={history.length <= 1}>
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={clearCanvas}>
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button onClick={handleSave}>
          <Download className="mr-2 h-4 w-4" />
          {t('whiteboard.save')}
        </Button>
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
      </div>
    </div>
  );
}
