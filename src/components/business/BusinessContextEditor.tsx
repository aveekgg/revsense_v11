import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBusinessContextDocument } from '@/hooks/useBusinessContextDocument';
import { useToast } from '@/hooks/use-toast';
import { Save, FileText, Info, ChevronDown, HelpCircle } from 'lucide-react';

const BusinessContextEditor = () => {
  const { content, isLoading, getDocument, saveDocument } = useBusinessContextDocument();
  const [editedContent, setEditedContent] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    getDocument();
  }, [getDocument]);

  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  const handleSave = async () => {
    await saveDocument(editedContent);
  };

  const hasChanges = editedContent !== content;

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This document helps the AI understand your business terminology, metrics, and data relationships.
          The more detailed you are, the better the AI will understand your queries.
        </AlertDescription>
      </Alert>

      <Card className="bg-muted/50">
        <Collapsible>
          <CardHeader>
            <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">How to Write Business Context</CardTitle>
              </div>
              <ChevronDown className="h-5 w-5 transition-transform duration-200 data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-6 text-sm">
                  <section>
                    <h3 className="font-semibold text-base mb-2 text-foreground">1. Defining Business Entities</h3>
                    <p className="text-muted-foreground mb-3">
                      Entities are the core objects in your business domain. Define each entity with its possible values and characteristics.
                    </p>
                    <div className="bg-background rounded-lg p-4 border space-y-3">
                      <div>
                        <p className="font-medium text-foreground mb-1">Example - Hotel Entity:</p>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`## Entity: Hotel
**Description:** Accommodation properties in our portfolio
**Possible Values:**
- Marriott (luxury chain, international presence)
- Taj (heritage luxury, primarily India)
- Hyatt (business-focused, urban locations)
- Holiday Inn (mid-range, family-friendly)

**Key Attributes:**
- Star Rating (1-5)
- Room Count
- Amenities (pool, spa, restaurant, gym)
- Brand Tier (luxury, premium, mid-range, budget)`}
                        </pre>
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">Example - Product Category:</p>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`## Entity: Product Category
**Values:** Electronics, Clothing, Home & Garden, Books
**Note:** Electronics includes laptops, phones, tablets`}
                        </pre>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2 text-foreground">2. Defining Entity Relationships</h3>
                    <p className="text-muted-foreground mb-3">
                      Explain how entities connect to each other. These relationships help the AI understand data structure.
                    </p>
                    <div className="bg-background rounded-lg p-4 border">
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`## Relationships

### Hotel Location Hierarchy
- Hotel → Located In → City
- City → Part Of → State
- State → Part Of → Country
- Example: "Taj Mahal Palace is located in Mumbai, 
  which is in Maharashtra state, India"

### Booking Relationships
- Customer → Makes → Booking
- Booking → For → Hotel
- Booking → Includes → Room Type
- Booking → Has → Payment

### Product Relationships
- Product → Belongs To → Category
- Product → Manufactured By → Supplier
- Order → Contains → Products
- Customer → Places → Order`}
                      </pre>
                    </div>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2 text-foreground">3. Derived Metrics</h3>
                    <p className="text-muted-foreground mb-3">
                      Define calculated metrics and KPIs with their formulas and business logic.
                    </p>
                    <div className="bg-background rounded-lg p-4 border space-y-3">
                      <div>
                        <p className="font-medium text-foreground mb-1">Revenue Metrics:</p>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`## Metric: Average Revenue Per Available Room (RevPAR)
**Formula:** Total Room Revenue / Total Available Rooms
**OR:** Occupancy Rate × Average Daily Rate (ADR)
**Business Rule:** Calculate per property per day
**When to Use:** Performance comparison across hotels

## Metric: Net Revenue
**Formula:** Gross Revenue - Discounts - Refunds - Taxes
**Exclude:** Cancelled bookings
**Include:** All payment methods`}
                        </pre>
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">Customer Metrics:</p>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`## Metric: Customer Lifetime Value (CLV)
**Formula:** Average Order Value × Purchase Frequency × 
            Customer Lifespan (in years)
**Segment By:** Customer tier (Gold, Silver, Bronze)

## Metric: Repeat Customer Rate
**Formula:** (Customers with >1 purchase / Total customers) × 100
**Time Period:** Calculate monthly and annually`}
                        </pre>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2 text-foreground">4. Business Rules & Context</h3>
                    <p className="text-muted-foreground mb-3">
                      Document important business logic, constraints, and domain knowledge.
                    </p>
                    <div className="bg-background rounded-lg p-4 border">
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`## Business Rules

### Booking Rules
- Check-in time: 2:00 PM
- Check-out time: 11:00 AM
- Cancellation: Free up to 24 hours before check-in
- Peak Season: December-January, July-August (20% premium)

### Pricing Rules
- Weekend rates: Friday-Sunday (15% higher)
- Corporate discount: 10% for company bookings
- Early bird: 15% off for bookings >30 days advance

### Data Quality Notes
- Sales data before 2020 may be incomplete
- Hotel "Sunrise Inn" rebranded to "Radiance Hotel" in Jan 2023
- All prices in USD unless specified`}
                      </pre>
                    </div>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2 text-foreground">Tips for Best Results</h3>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li>Be specific about entity values and what they represent</li>
                      <li>Document abbreviations and acronyms used in your data</li>
                      <li>Explain any unusual data patterns or outliers</li>
                      <li>Include examples of how metrics are calculated</li>
                      <li>Update this document as your business evolves</li>
                      <li>Use consistent terminology throughout</li>
                    </ul>
                  </section>
                </div>
              </ScrollArea>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Business Context Document
          </CardTitle>
          <CardDescription className="mt-2">
            Edit this markdown document to teach the AI about your business.
            Use the template below as a guide.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            placeholder="Write your business context here..."
            className="min-h-[500px] font-mono text-sm"
            disabled={isLoading}
          />
          <div className="flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={isLoading || !hasChanges}
            >
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save Context'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessContextEditor;
