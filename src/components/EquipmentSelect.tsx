import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Equip {
  id: string;
  name: string;
  brand: string | null;
  serial_number: string | null;
}

/**
 * Dropdown of saved equipments. Fills three text fields:
 *  - `${brandKey}` -> brand
 *  - `${nameKey}`  -> model/name
 *  - `${serialKey}` -> serial number
 */
export function EquipmentSelect({
  label,
  brandKey = "equip_marca",
  nameKey,
  serialKey,
  data,
  onChange,
}: {
  label: string;
  brandKey?: string;
  nameKey: string;
  serialKey: string;
  data: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const [list, setList] = useState<Equip[]>([]);

  useEffect(() => {
    supabase
      .from("equipments")
      .select("id, name, brand, serial_number")
      .order("name")
      .then(({ data }) => setList((data ?? []) as Equip[]));
  }, []);

  const handleSelect = (id: string) => {
    const eq = list.find((x) => x.id === id);
    if (!eq) {
      onChange(brandKey, "");
      onChange(nameKey, "");
      onChange(serialKey, "");
      return;
    }
    onChange(brandKey, eq.brand || "");
    onChange(nameKey, eq.name || "");
    onChange(serialKey, eq.serial_number || "");
  };

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label className="text-xs font-medium">{label}</Label>
      <select
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
        defaultValue=""
        onChange={(e) => handleSelect(e.target.value)}
      >
        <option value="">— Selecionar cadastrado —</option>
        {list.map((eq) => (
          <option key={eq.id} value={eq.id}>
            {[eq.brand, eq.name].filter(Boolean).join(" ")}
            {eq.serial_number ? ` (S/N ${eq.serial_number})` : ""}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-3 gap-2">
        <Input
          placeholder="Marca"
          value={data[brandKey] || ""}
          onChange={(e) => onChange(brandKey, e.target.value)}
        />
        <Input
          placeholder="Modelo"
          value={data[nameKey] || ""}
          onChange={(e) => onChange(nameKey, e.target.value)}
        />
        <Input
          placeholder="Nº série"
          value={data[serialKey] || ""}
          onChange={(e) => onChange(serialKey, e.target.value)}
        />
      </div>
    </div>
  );
}
