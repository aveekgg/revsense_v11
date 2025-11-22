export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      business_context: {
        Row: {
          context_type: string
          created_at: string | null
          definition: string
          examples: string[] | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          context_type: string
          created_at?: string | null
          definition: string
          examples?: string[] | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          context_type?: string
          created_at?: string | null
          definition?: string
          examples?: string[] | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          chart_suggestion: Json | null
          content: string
          created_at: string | null
          data_summary: string | null
          id: string
          metadata: Json | null
          query_result: Json | null
          role: string
          session_id: string | null
          sql_query: string | null
        }
        Insert: {
          chart_suggestion?: Json | null
          content: string
          created_at?: string | null
          data_summary?: string | null
          id?: string
          metadata?: Json | null
          query_result?: Json | null
          role: string
          session_id?: string | null
          sql_query?: string | null
        }
        Update: {
          chart_suggestion?: Json | null
          content?: string
          created_at?: string | null
          data_summary?: string | null
          id?: string
          metadata?: Json | null
          query_result?: Json | null
          role?: string
          session_id?: string | null
          sql_query?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      clean_asset_data: {
        Row: {
          asset_name: string
          city: string
          extracted_at: string | null
          id: string
          source_mapping_id: string | null
          source_workbook: string | null
          total_available_rooms: number
          user_id: string
        }
        Insert: {
          asset_name: string
          city: string
          extracted_at?: string | null
          id?: string
          source_mapping_id?: string | null
          source_workbook?: string | null
          total_available_rooms: number
          user_id: string
        }
        Update: {
          asset_name?: string
          city?: string
          extracted_at?: string | null
          id?: string
          source_mapping_id?: string | null
          source_workbook?: string | null
          total_available_rooms?: number
          user_id?: string
        }
        Relationships: []
      }
      clean_data: {
        Row: {
          data: Json
          extracted_at: string | null
          id: string
          schema_id: string | null
          source_mapping_id: string | null
          source_workbook: string | null
          user_id: string | null
        }
        Insert: {
          data: Json
          extracted_at?: string | null
          id?: string
          schema_id?: string | null
          source_mapping_id?: string | null
          source_workbook?: string | null
          user_id?: string | null
        }
        Update: {
          data?: Json
          extracted_at?: string | null
          id?: string
          schema_id?: string | null
          source_mapping_id?: string | null
          source_workbook?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clean_data_schema_id_fkey"
            columns: ["schema_id"]
            isOneToOne: false
            referencedRelation: "schemas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clean_data_source_mapping_id_fkey"
            columns: ["source_mapping_id"]
            isOneToOne: false
            referencedRelation: "mappings"
            referencedColumns: ["id"]
          },
        ]
      }
      clean_hotel_revenue_data: {
        Row: {
          asset_name: string
          extracted_at: string | null
          food_and_beverage_revenue: number | null
          id: string
          other_revenue: number | null
          period_start: string
          period_type: string
          room_nights_sold: number
          room_revenue: number
          source_mapping_id: string | null
          source_workbook: string | null
          user_id: string
        }
        Insert: {
          asset_name: string
          extracted_at?: string | null
          food_and_beverage_revenue?: number | null
          id?: string
          other_revenue?: number | null
          period_start: string
          period_type: string
          room_nights_sold: number
          room_revenue: number
          source_mapping_id?: string | null
          source_workbook?: string | null
          user_id: string
        }
        Update: {
          asset_name?: string
          extracted_at?: string | null
          food_and_beverage_revenue?: number | null
          id?: string
          other_revenue?: number | null
          period_start?: string
          period_type?: string
          room_nights_sold?: number
          room_revenue?: number
          source_mapping_id?: string | null
          source_workbook?: string | null
          user_id?: string
        }
        Relationships: []
      }
      clean_monthly_performance_summary: {
        Row: {
          avg_order_value: number
          extracted_at: string | null
          fulfillment_rate: number
          id: string
          new_customers: number
          one_time_orders: number
          report_month: string
          returning_customers: number
          source_mapping_id: string | null
          source_workbook: string | null
          subscription_orders: number
          top_product: string
          top_product_revenue: number
          top_state: string | null
          total_orders: number
          total_revenue: number
          user_id: string
        }
        Insert: {
          avg_order_value: number
          extracted_at?: string | null
          fulfillment_rate: number
          id?: string
          new_customers: number
          one_time_orders: number
          report_month: string
          returning_customers: number
          source_mapping_id?: string | null
          source_workbook?: string | null
          subscription_orders: number
          top_product: string
          top_product_revenue: number
          top_state?: string | null
          total_orders: number
          total_revenue: number
          user_id: string
        }
        Update: {
          avg_order_value?: number
          extracted_at?: string | null
          fulfillment_rate?: number
          id?: string
          new_customers?: number
          one_time_orders?: number
          report_month?: string
          returning_customers?: number
          source_mapping_id?: string | null
          source_workbook?: string | null
          subscription_orders?: number
          top_product?: string
          top_product_revenue?: number
          top_state?: string | null
          total_orders?: number
          total_revenue?: number
          user_id?: string
        }
        Relationships: []
      }
      dashboard_charts: {
        Row: {
          chart_type: string
          config: Json | null
          created_at: string | null
          dashboard_id: string | null
          id: string
          position: number | null
          sql_query: string
          title: string
        }
        Insert: {
          chart_type: string
          config?: Json | null
          created_at?: string | null
          dashboard_id?: string | null
          id?: string
          position?: number | null
          sql_query: string
          title: string
        }
        Update: {
          chart_type?: string
          config?: Json | null
          created_at?: string | null
          dashboard_id?: string | null
          id?: string
          position?: number | null
          sql_query?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_charts_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboards: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mappings: {
        Row: {
          created_at: string | null
          description: string | null
          field_mappings: Json
          id: string
          name: string
          schema_id: string | null
          tags: string[] | null
          updated_at: string | null
          user_id: string | null
          workbook_format: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          field_mappings?: Json
          id?: string
          name: string
          schema_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          workbook_format?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          field_mappings?: Json
          id?: string
          name?: string
          schema_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          workbook_format?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mappings_schema_id_fkey"
            columns: ["schema_id"]
            isOneToOne: false
            referencedRelation: "schemas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      schemas: {
        Row: {
          created_at: string | null
          description: string | null
          fields: Json
          id: string
          name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          fields?: Json
          id?: string
          name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          fields?: Json
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      execute_ddl: { Args: { ddl_statement: string }; Returns: Json }
      execute_safe_query: { Args: { query_text: string }; Returns: Json }
      get_table_columns: {
        Args: { p_table_name: string }
        Returns: {
          column_name: string
          data_type: string
          is_nullable: string
        }[]
      }
      sanitize_table_name: { Args: { name: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
