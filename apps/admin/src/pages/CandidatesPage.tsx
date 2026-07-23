import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Plus, Trash2, AlertTriangle, Camera, Upload, Edit, Edit2, Crop } from "lucide-react";
import { ImageCropModal } from "../components/ImageCropModal";
import type { Candidate } from "@pageant/types";
import { Button } from "@pageant/ui/components/button";
import { Card } from "@pageant/ui/components/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@pageant/ui/components/dialog";
import { Input } from "@pageant/ui/components/input";
import { Label } from "@pageant/ui/components/label";

const API_BASE = "/api";

export function CandidatesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editCandidateData, setEditCandidateData] = useState<Candidate | null>(null);
  const [deleteCandidateTarget, setDeleteCandidateTarget] = useState<Candidate | null>(null);
  const [deletingCand, setDeletingCand] = useState(false);
  const [form, setForm] = useState({ name: "", candidateNumber: 1, barangay: "", municipality: "", province: "", region: "", country: "" });
  const [createPhotoFile, setCreatePhotoFile] = useState<File | null>(null);
  const [createPhotoPreview, setCreatePhotoPreview] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropContext, setCropContext] = useState<"add" | "edit">("add");

  const fetchCandidates = async () => {
    const res = await fetch(`${API_BASE}/pageants/${id}/candidates`, { credentials: "include" });
    const data = await res.json();
    if (data.success) setCandidates(data.data);
  };

  useEffect(() => { fetchCandidates(); }, [id]);

  const loadImageAsDataUrl = async (url: string): Promise<string> => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  };

  const startImageCrop = async (source: File | string | undefined, context: "add" | "edit", candidate?: Candidate) => {
    if (!source) return;
    setCropContext(context);
    if (candidate) {
      setEditCandidateData(candidate);
    }
    if (typeof source === "string") {
      const dataUrl = await loadImageAsDataUrl(source);
      setCropImageSrc(dataUrl);
      setCropModalOpen(true);
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropImageSrc(reader.result as string);
        setCropModalOpen(true);
      };
      reader.readAsDataURL(source);
    }
  };

  const handleCropComplete = async (croppedFile: File, previewUrl: string) => {
    if (cropContext === "add") {
      setCreatePhotoFile(croppedFile);
      setCreatePhotoPreview(previewUrl);
    } else if (cropContext === "edit" && editCandidateData) {
      await uploadPhoto(editCandidateData.id, croppedFile);
    }
  };

  const createCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_BASE}/pageants/${id}/candidates`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.success && data.data) {
      if (createPhotoFile) {
        await uploadPhoto(data.data.id, createPhotoFile);
      }
      setShowCreate(false);
      setForm({
        name: "",
        candidateNumber: candidates.length + 2,
        barangay: "",
        municipality: "",
        province: "",
        region: "",
        country: "",
      });
      setCreatePhotoFile(null);
      setCreatePhotoPreview(null);
      fetchCandidates();
    }
  };

  const updateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCandidateData) return;
    await fetch(`${API_BASE}/candidates/${editCandidateData.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({
        name: editCandidateData.name,
        candidateNumber: editCandidateData.candidateNumber,
        barangay: editCandidateData.barangay,
        municipality: editCandidateData.municipality,
        province: editCandidateData.province,
        region: editCandidateData.region,
        country: editCandidateData.country,
      }),
    });
    setEditCandidateData(null);
    fetchCandidates();
  };

  const handleDeleteCandidate = async () => {
    if (!deleteCandidateTarget) return;
    setDeletingCand(true);
    try {
      await fetch(`${API_BASE}/candidates/${deleteCandidateTarget.id}`, { method: "DELETE", credentials: "include" });
      setDeleteCandidateTarget(null);
      fetchCandidates();
    } catch {
      /* ignore */
    } finally {
      setDeletingCand(false);
    }
  };

  const uploadPhoto = async (cId: string, file: File) => {
    const fd = new FormData();
    fd.append("photo", file);
    const res = await fetch(`${API_BASE}/candidates/${cId}/photo`, { method: "POST", credentials: "include", body: fd });
    const data = await res.json();
    if (data.success) {
      if (editCandidateData?.id === cId) {
        setEditCandidateData((prev) => (prev ? { ...prev, photoUrl: data.data.photoUrl } : null));
      }
      fetchCandidates();
    }
  };

  const getFallback = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=256&bold=true`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/pageants/${id}`)} className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h1 className="text-lg font-bold text-foreground">Candidates</h1>
            <span className="text-xs text-muted-foreground">{candidates.length} total</span>
          </div>
          <Button onClick={() => { setForm({ name: "", candidateNumber: candidates.length + 1, barangay: "", municipality: "", province: "", region: "", country: "" }); setCreatePhotoFile(null); setCreatePhotoPreview(null); setShowCreate(true); }} >
            <Plus className="w-4 h-4 mr-1.5" /> Add Candidate
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {candidates.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p>No candidates yet. Add your first candidate.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidates.map((c) => (
              <Card key={c.id} className="group hover:border-primary/30 transition-all flex flex-col justify-between p-0 rounded-xl">
                {/* Photo */}
                <div className="relative">
                  <img src={c.photoUrl || getFallback(c.name)} alt={c.name} className="w-full aspect-square object-cover bg-secondary" />
                  <div className="absolute top-2 left-2 w-10 h-10 bg-black/20 border border-white rounded-xl flex items-center justify-center text-md font-bold shadow-lg">
                    {c.candidateNumber}
                  </div>
                </div>

                {/* Info */}
                <div className="flex items-center justify-between px-5 pb-3">
                  <div>
                    <h3 className="font-bold text-foreground text-sm truncate max-w-37.5">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">Candidate #{c.candidateNumber}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setEditCandidateData(c)} className="text-xs py-1 px-2.5">
                      <Edit2 />Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setDeleteCandidateTarget(c)} className="text-xs py-1 px-2.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Add Candidate Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) { setCreatePhotoFile(null); setCreatePhotoPreview(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
          </DialogHeader>
          <form onSubmit={createCandidate} className="space-y-4">
            {/* Candidate Photo Upload */}
            <div className="flex flex-col items-center justify-center space-y-2 pb-2">
              <div className="relative group w-28 h-28 shrink-0">
                <img
                  src={createPhotoPreview || getFallback(form.name || "New Candidate")}
                  alt="Preview"
                  className="w-28 h-28 rounded-2xl object-cover bg-secondary border border-border shadow-sm"
                />
                <label className="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                  <Camera className="w-6 h-6 text-white mb-1" />
                  <span className="text-white text-[10px] font-bold">Choose & Crop</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => startImageCrop(e.target.files?.[0], "add")}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer text-xs font-medium text-primary hover:underline flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  {createPhotoFile ? "Change Photo" : "Upload Photo"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => startImageCrop(e.target.files?.[0], "add")}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <div className="space-y-1.5 w-full">
              <Label htmlFor="candidate-name">Name *</Label>
              <Input
                id="candidate-name"
                placeholder="e.g. Candidate Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5 w-full">
              <Label htmlFor="candidate-number">Candidate Number *</Label>
              <Input
                id="candidate-number"
                type="number"
                min={1}
                value={form.candidateNumber}
                onChange={(e) => setForm({ ...form, candidateNumber: Number(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-1 w-full border-t border-border pt-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Location Info (Optional)</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="space-y-1.5 w-full">
                <Label htmlFor="candidate-barangay">Barangay</Label>
                <Input
                  id="candidate-barangay"
                  placeholder="e.g. Brgy. 1"
                  value={form.barangay}
                  onChange={(e) => setForm({ ...form, barangay: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 w-full">
                <Label htmlFor="candidate-municipality">Municipality/City</Label>
                <Input
                  id="candidate-municipality"
                  placeholder="e.g. Naga City"
                  value={form.municipality}
                  onChange={(e) => setForm({ ...form, municipality: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 w-full">
                <Label htmlFor="candidate-province">Province</Label>
                <Input
                  id="candidate-province"
                  placeholder="e.g. Camarines Sur"
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 w-full">
                <Label htmlFor="candidate-region">Region</Label>
                <Input
                  id="candidate-region"
                  placeholder="e.g. Bicol Region"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5 w-full">
              <Label htmlFor="candidate-country">Country</Label>
              <Input
                id="candidate-country"
                placeholder="e.g. Philippines"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full py-3">Add Candidate</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Candidate Dialog */}
      <Dialog open={!!editCandidateData} onOpenChange={(open) => { if (!open) setEditCandidateData(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Candidate</DialogTitle>
          </DialogHeader>
          {editCandidateData && (
            <form onSubmit={updateCandidate} className="space-y-4">
              {/* Candidate Photo */}
              <div className="flex flex-col items-center justify-center space-y-2 pb-2">
                <div className="relative group w-28 h-28 shrink-0">
                  <img
                    src={editCandidateData.photoUrl || getFallback(editCandidateData.name)}
                    alt={editCandidateData.name}
                    className="w-28 h-28 rounded-2xl object-cover bg-secondary border border-border shadow-sm"
                  />
                  <label className="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                    <Camera className="w-6 h-6 text-white mb-1" />
                    <span className="text-white text-[10px] font-bold">Crop & Adjust</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => startImageCrop(e.target.files?.[0], "edit")}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer text-xs font-medium text-primary hover:underline flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" />
                    Upload & Crop
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => startImageCrop(e.target.files?.[0], "edit")}
                      className="hidden"
                    />
                  </label>
                  {(editCandidateData.photoUrl || getFallback(editCandidateData.name)) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-[11px] h-7 px-2 gap-1"
                      onClick={() => startImageCrop(editCandidateData.photoUrl || getFallback(editCandidateData.name), "edit", editCandidateData)}
                    >
                      <Crop className="w-3 h-3 text-primary" /> Align Image
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 w-full">
                <Label htmlFor="edit-candidate-name">Name *</Label>
                <Input
                  id="edit-candidate-name"
                  value={editCandidateData.name}
                  onChange={(e) => setEditCandidateData({ ...editCandidateData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5 w-full">
                <Label htmlFor="edit-candidate-number">Candidate Number *</Label>
                <Input
                  id="edit-candidate-number"
                  type="number"
                  min={1}
                  value={editCandidateData.candidateNumber}
                  onChange={(e) => setEditCandidateData({ ...editCandidateData, candidateNumber: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-1 w-full border-t border-border pt-3">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Location Info (Optional)</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="space-y-1.5 w-full">
                  <Label htmlFor="edit-candidate-barangay">Barangay</Label>
                  <Input
                    id="edit-candidate-barangay"
                    placeholder="e.g. Brgy. 1"
                    value={editCandidateData.barangay || ""}
                    onChange={(e) => setEditCandidateData({ ...editCandidateData, barangay: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 w-full">
                  <Label htmlFor="edit-candidate-municipality">Municipality/City</Label>
                  <Input
                    id="edit-candidate-municipality"
                    placeholder="e.g. Naga City"
                    value={editCandidateData.municipality || ""}
                    onChange={(e) => setEditCandidateData({ ...editCandidateData, municipality: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 w-full">
                  <Label htmlFor="edit-candidate-province">Province</Label>
                  <Input
                    id="edit-candidate-province"
                    placeholder="e.g. Camarines Sur"
                    value={editCandidateData.province || ""}
                    onChange={(e) => setEditCandidateData({ ...editCandidateData, province: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 w-full">
                  <Label htmlFor="edit-candidate-region">Region</Label>
                  <Input
                    id="edit-candidate-region"
                    placeholder="e.g. Bicol Region"
                    value={editCandidateData.region || ""}
                    onChange={(e) => setEditCandidateData({ ...editCandidateData, region: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5 w-full">
                <Label htmlFor="edit-candidate-country">Country</Label>
                <Input
                  id="edit-candidate-country"
                  placeholder="e.g. Philippines"
                  value={editCandidateData.country || ""}
                  onChange={(e) => setEditCandidateData({ ...editCandidateData, country: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button type="button" variant="ghost" onClick={() => setEditCandidateData(null)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {/* Delete Candidate Confirmation Dialog */}
      <Dialog open={!!deleteCandidateTarget} onOpenChange={(open) => { if (!open) setDeleteCandidateTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">Delete Candidate</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
          </DialogHeader>

          {deleteCandidateTarget && (
            <div className="py-2">
              <p className="text-sm text-foreground">
                Are you sure you want to delete <span className="font-bold">{deleteCandidateTarget.name}</span> (Candidate #{deleteCandidateTarget.candidateNumber})? All associated score records will be permanently removed.
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteCandidateTarget(null)}
              disabled={deletingCand}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingCand}
              onClick={handleDeleteCandidate}
              className="gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              {deletingCand ? "Deleting..." : "Delete Candidate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Image Crop Modal */}
      <ImageCropModal
        open={cropModalOpen}
        imageSrc={cropImageSrc}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
