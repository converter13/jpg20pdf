import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Download, Loader2, MoveVertical, Plus, Trash2 } from "lucide-react";
import type { Upload } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  const [shareId, setShareId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Query for uploaded images
  const { data: uploads = [], refetch } = useQuery({
    queryKey: ["/api/uploads", shareId],
    queryFn: async () => {
      if (!shareId) return [];
      const res = await fetch(`/api/uploads/${shareId}`);
      if (!res.ok) throw new Error("Failed to fetch uploads");
      return res.json();
    },
    enabled: !!shareId
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append("files", file);
      });

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to upload images");
      }

      const data = await res.json();
      setShareId(data[0].shareId);
      return data;
    },
    onSuccess: () => {
      setError(null);
      toast({
        title: "Success!",
        description: "Images uploaded successfully.",
      });
      refetch();
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: number; order: number }[]) => {
      const res = await apiRequest("PATCH", "/api/uploads/reorder", updates);
      return res.json();
    },
    onSuccess: () => {
      refetch();
    },
  });

  // Generate PDF mutation
  const generatePdfMutation = useMutation({
    mutationFn: async () => {
      if (!shareId) throw new Error("No images selected");

      const res = await fetch(`/api/uploads/${shareId}/pdf`, {
        method: "POST"
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to generate PDF");
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = res.headers.get("Content-Disposition");
      const filename = contentDisposition?.split("filename=")[1]?.replace(/"/g, "") || "images.pdf";

      // Create blob from response and download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/uploads/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete image");
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Image deleted successfully",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  // Handle file input change
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      uploadMutation.mutate(files);
    }
  };

  // Handle reordering
  const moveImage = (upload: Upload, direction: "up" | "down") => {
    const currentIndex = uploads.findIndex(u => u.id === upload.id);
    if (
      (direction === "up" && currentIndex === 0) ||
      (direction === "down" && currentIndex === uploads.length - 1)
    ) {
      return;
    }

    const newUploads = [...uploads];
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const targetUpload = newUploads[targetIndex];

    // Swap orders
    const updates = [
      { id: upload.id, order: targetUpload.order },
      { id: targetUpload.id, order: upload.order }
    ];

    reorderMutation.mutate(updates);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            Image to PDF Converter
          </h1>
          <p className="text-muted-foreground">
            Convert your images to PDF quickly and easily. Upload multiple images, arrange them in any order, and generate a PDF.
          </p>
        </div>

        {error && (
          <Card className="p-4 border-red-200 bg-red-50">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </Card>
        )}

        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploadMutation.isPending}
                className="flex-1"
              />
              <Button disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Images
                  </>
                )}
              </Button>
            </div>

            {uploads.length > 0 && (
              <div className="space-y-4">
                <div className="grid gap-4">
                  {uploads.map((upload, index) => (
                    <Card key={upload.id} className="p-4">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium">{index + 1}</span>
                        <div className="relative aspect-video w-40">
                          <img
                            src={upload.fileUrl}
                            alt={upload.filename}
                            className="absolute inset-0 h-full w-full object-cover rounded-md"
                          />
                        </div>
                        <div className="flex-1 truncate">
                          <p className="text-sm font-medium truncate">
                            {upload.filename}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => moveImage(upload, "up")}
                            disabled={index === 0}
                          >
                            <MoveVertical className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => moveImage(upload, "down")}
                            disabled={index === uploads.length - 1}
                          >
                            <MoveVertical className="h-4 w-4 rotate-180" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => deleteMutation.mutate(upload.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <Button
                  className="w-full"
                  onClick={() => generatePdfMutation.mutate()}
                  disabled={generatePdfMutation.isPending}
                >
                  {generatePdfMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Generate PDF
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}