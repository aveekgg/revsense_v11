import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useChatEntities, EntityType, ChatEntity } from '@/hooks/useChatEntities';
import { Plus, Trash2, Edit2, Building2, User, Briefcase, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

const getEntityIcon = (type: string) => {
  switch (type) {
    case 'hotel':
      return <Building2 className="h-4 w-4 text-blue-500" />;
    case 'operator':
      return <User className="h-4 w-4 text-green-500" />;
    case 'legal_entity':
      return <Briefcase className="h-4 w-4 text-purple-500" />;
    case 'metric':
      return <TrendingUp className="h-4 w-4 text-orange-500" />;
    default:
      return null;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'hotel':
      return 'Hotel';
    case 'operator':
      return 'Operator';
    case 'legal_entity':
      return 'Legal Entity';
    case 'metric':
      return 'Metric';
    default:
      return type;
  }
};

const getTypeBadgeColor = (type: string) => {
  switch (type) {
    case 'hotel':
      return 'bg-blue-500/10 text-blue-700 border-blue-200';
    case 'operator':
      return 'bg-green-500/10 text-green-700 border-green-200';
    case 'legal_entity':
      return 'bg-purple-500/10 text-purple-700 border-purple-200';
    case 'metric':
      return 'bg-orange-500/10 text-orange-700 border-orange-200';
    default:
      return '';
  }
};

export const ChatEntitiesManager = () => {
  const [filter, setFilter] = useState<EntityType | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<ChatEntity | null>(null);
  const [deleteEntity, setDeleteEntity] = useState<ChatEntity | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'hotel' as EntityType,
    description: '',
  });

  const filterType = filter === 'all' ? undefined : filter;
  const {
    entities,
    isLoading,
    createEntity,
    updateEntity,
    deleteEntity: deleteEntityMutation,
    isCreating,
    isUpdating,
    isDeleting,
  } = useChatEntities(filterType);

  const handleOpenDialog = (entity?: ChatEntity) => {
    if (entity) {
      setEditingEntity(entity);
      setFormData({
        name: entity.name,
        type: entity.type,
        description: entity.description || '',
      });
    } else {
      setEditingEntity(null);
      setFormData({
        name: '',
        type: 'hotel',
        description: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingEntity(null);
    setFormData({
      name: '',
      type: 'hotel',
      description: '',
    });
  };

  const handleSave = () => {
    if (editingEntity) {
      updateEntity({
        id: editingEntity.id,
        input: {
          name: formData.name,
          description: formData.description || undefined,
        },
      });
    } else {
      createEntity({
        name: formData.name,
        type: formData.type,
        description: formData.description || undefined,
      });
    }
    handleCloseDialog();
  };

  const handleDelete = () => {
    if (deleteEntity) {
      deleteEntityMutation(deleteEntity.id);
      setDeleteEntity(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Chat Entities & Metrics</CardTitle>
              <CardDescription>
                Manage entities and metrics that can be mentioned in chat using @ for entities and ~ for metrics
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label>Filter by Type</Label>
            <Select value={filter} onValueChange={(value) => setFilter(value as EntityType | 'all')}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="hotel">Hotels</SelectItem>
                <SelectItem value="operator">Operators</SelectItem>
                <SelectItem value="legal_entity">Legal Entities</SelectItem>
                <SelectItem value="metric">Metrics</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : entities.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No entities found</p>
                <p className="text-sm mt-2">Click "Add New" to create your first entity or metric</p>
              </div>
            ) : (
              <div className="space-y-2">
                {entities.map((entity) => (
                  <Card key={entity.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getEntityIcon(entity.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{entity.name}</h4>
                            <Badge variant="outline" className={getTypeBadgeColor(entity.type)}>
                              {getTypeLabel(entity.type)}
                            </Badge>
                          </div>
                          {entity.description && (
                            <p className="text-sm text-muted-foreground">{entity.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Created: {new Date(entity.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(entity)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteEntity(entity)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntity ? 'Edit' : 'Create'} Entity</DialogTitle>
            <DialogDescription>
              {editingEntity ? 'Update the entity details' : 'Add a new entity or metric for chat mentions'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Grand Hotel, Total Revenue"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value as EntityType })}
                disabled={!!editingEntity}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hotel">Hotel (use @)</SelectItem>
                  <SelectItem value="operator">Operator (use @)</SelectItem>
                  <SelectItem value="legal_entity">Legal Entity (use @)</SelectItem>
                  <SelectItem value="metric">Metric (use ~)</SelectItem>
                </SelectContent>
              </Select>
              {editingEntity && (
                <p className="text-xs text-muted-foreground">Type cannot be changed after creation</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description or notes"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!formData.name.trim() || isCreating || isUpdating}
            >
              {isCreating || isUpdating ? 'Saving...' : editingEntity ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEntity} onOpenChange={() => setDeleteEntity(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entity?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteEntity?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
