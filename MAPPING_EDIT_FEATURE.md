# Mapping Edit Feature

## Overview
Added the ability to edit existing mappings directly from the mapping details sheet (right slider pane) that appears when clicking the eye icon on a mapping card.

## Changes Made

### 1. MappingDetailsSheet Component (`src/components/mapping/MappingDetailsSheet.tsx`)

#### New Features:
- **Edit Mode Toggle**: Click "Edit Mapping" button to enter edit mode
- **Editable Fields**:
  - Mapping Name (inline input in the header)
  - Description (textarea in the header)
  - Tags (comma-separated input)
  - Field Formulas (textarea for each field mapping)

#### New Props:
- `onUpdate?: (id: string, name: string, description: string, tags: string[], schemaId: string, fieldMappings: FieldMapping[]) => Promise<void>`

#### UI Components Added:
- Edit/Save/Cancel buttons
- Input fields that replace read-only text when in edit mode
- Form validation (checks for empty name)
- Loading state while saving
- Toast notifications for success/error states

#### State Management:
- `isEditMode`: Tracks whether user is editing
- `editedName`, `editedDescription`, `editedTags`: Track edited values
- `editedFieldMappings`: Track edited field mapping formulas
- `isSaving`: Loading state during save operation

#### Functionality:
- Changes are local until saved (cancel restores original values)
- Updates persist to database through `updateMappingById` from ExcelContext
- Refreshes mapping list after successful update

### 2. ProjectConfig Component (`src/pages/ProjectConfig.tsx`)

#### Changes:
- Added `updateMappingById` and `refreshMappings` from ExcelContext
- Created `handleUpdateMapping` function to handle updates and refresh
- Passed `onUpdate={handleUpdateMapping}` to `MappingDetailsSheet`

## User Flow

1. **View Mapping**: Click the eye icon on any mapping card
2. **Enter Edit Mode**: Click "Edit Mapping" button in the sheet header
3. **Make Changes**: 
   - Update name, description, tags in the header
   - Modify formulas for individual fields in the field mappings section
4. **Save Changes**: Click "Save Changes" button
   - Shows loading state during save
   - Displays success toast
   - Exits edit mode
   - Refreshes mapping list
5. **Cancel Changes**: Click "Cancel" button to discard changes and exit edit mode

## Features

### ✅ Implemented
- Edit mapping name inline
- Edit mapping description
- Edit tags (comma-separated)
- Edit field formulas directly
- Save changes to database
- Cancel editing to restore original values
- Form validation
- Loading states
- Success/error notifications
- Auto-refresh after save

### 🎯 Preserved Functionality
- All existing view-only features remain intact
- Eye icon still opens the details sheet
- Mapping cards still work as before
- No breaking changes to existing functionality

## Technical Notes

- Uses React state management for local edits
- Integrates with existing Supabase backend through ExcelContext
- Maintains type safety with TypeScript
- Follows existing UI patterns and component structure
- Fully responsive design
- Accessible keyboard navigation
