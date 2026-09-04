"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type {
  Listing,
  FuelType,
  Gearbox,
  Transmission,
  ListingCondition,
  ListingCategory,
} from "@prisma/client";

type WilayaRow = { id: number; nomFr: string; nomAr: string };
type ModelRow = { id: number; slug: string; name: string; brandId: number };
type BrandRow = { id: number; slug: string; name: string; models: ModelRow[] };

const CATEGORIES: ListingCategory[] = ["VOITURE", "UTILITAIRE", "POIDS_LOURD", "DEUX_ROUES", "AUTRE"];
const CATEGORY_KEY: Record<ListingCategory, string> = {
  VOITURE: "categoryVoiture",
  UTILITAIRE: "categoryUtilitaire",
  POIDS_LOURD: "categoryPoidsLourd",
  DEUX_ROUES: "categoryDeuxRoues",
  AUTRE: "categoryAutre",
};

const ERROR_KEY: Record<string, string> = {
  validation: "errorValidation",
  unknown_wilaya: "errorValidation",
  unknown_brand: "errorValidation",
  unknown_model: "errorValidation",
  at_least_one_photo: "errorAtLeastOnePhoto",
  too_many_photos: "errorTooManyPhotos",
  photo_too_large: "errorPhotoTooLarge",
  photo_invalid_type: "errorPhotoInvalidType",
  forbidden: "errorGeneric",
  invalid_status: "errorGeneric",
};

const MAX_PHOTOS = 10;

export function ListingEditForm({
  listing,
  wilayas,
  brands,
}: {
  listing: Listing & { photos: { id: string; path: string }[] };
  wilayas: WilayaRow[];
  brands: BrandRow[];
}) {
  const t = useTranslations("ListingEdit");
  const tWizard = useTranslations("Wizard");
  const locale = useLocale();
  const router = useRouter();

  const [category, setCategory] = useState<ListingCategory>(listing.category);
  const [brandId, setBrandId] = useState<number | undefined>(listing.brandId ?? undefined);
  const [brandFreeText, setBrandFreeText] = useState(listing.brandFreeText ?? "");
  const [brandOther, setBrandOther] = useState(!listing.brandId && Boolean(listing.brandFreeText));
  const [modelId, setModelId] = useState<number | undefined>(listing.modelId ?? undefined);
  const [modelFreeText, setModelFreeText] = useState(listing.modelFreeText ?? "");
  const [modelOther, setModelOther] = useState(!listing.modelId && Boolean(listing.modelFreeText));

  const selectedBrand = useMemo(() => brands.find((b) => b.id === brandId) ?? null, [brands, brandId]);

  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [year, setYear] = useState(listing.year);
  const [mileage, setMileage] = useState(listing.mileage);
  const [fuelType, setFuelType] = useState<FuelType>(listing.fuelType);
  const [gearbox, setGearbox] = useState<Gearbox>(listing.gearbox);
  const [transmission, setTransmission] = useState<Transmission | "">(listing.transmission ?? "");
  const [color, setColor] = useState(listing.color ?? "");
  const [doors, setDoors] = useState<number | "">(listing.doors ?? "");
  const [seats, setSeats] = useState<number | "">(listing.seats ?? "");
  const [powerHp, setPowerHp] = useState<number | "">(listing.powerHp ?? "");
  const [condition, setCondition] = useState<ListingCondition>(listing.condition);
  const [firstHand, setFirstHand] = useState(listing.firstHand);
  const [accidented, setAccidented] = useState(listing.accidented);
  const [wilayaId, setWilayaId] = useState<number>(listing.wilayaId);

  const [existingPhotos, setExistingPhotos] = useState(listing.photos);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const newPhotoPreviews = useMemo(() => newPhotos.map((f) => URL.createObjectURL(f)), [newPhotos]);
  useEffect(() => {
    return () => {
      newPhotoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newPhotoPreviews]);
  const totalPhotoCount = existingPhotos.length + newPhotos.length;

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function moveExistingPhoto(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= existingPhotos.length) return;
    const next = [...existingPhotos];
    [next[index], next[target]] = [next[target], next[index]];
    setExistingPhotos(next);
  }

  function removeExistingPhoto(index: number) {
    setExistingPhotos(existingPhotos.filter((_, i) => i !== index));
  }

  function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setNewPhotos([...newPhotos, ...files].slice(0, Math.max(0, MAX_PHOTOS - existingPhotos.length)));
  }

  function removeNewPhoto(index: number) {
    setNewPhotos(newPhotos.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.append(
      "data",
      JSON.stringify({
        category,
        brandId: brandOther ? undefined : brandId,
        brandFreeText: brandOther ? brandFreeText.trim() || undefined : undefined,
        modelId: brandOther || modelOther ? undefined : modelId,
        modelFreeText: brandOther || modelOther ? modelFreeText.trim() || undefined : undefined,
        title,
        description,
        year,
        mileage,
        fuelType,
        gearbox,
        transmission: transmission || undefined,
        color: color.trim() || undefined,
        doors: doors === "" ? undefined : doors,
        seats: seats === "" ? undefined : seats,
        powerHp: powerHp === "" ? undefined : powerHp,
        condition,
        firstHand,
        accidented,
        wilayaId,
        existingPhotoIds: existingPhotos.map((p) => p.id),
      })
    );
    for (const file of newPhotos) {
      formData.append("newPhotos", file);
    }

    const res = await fetch(`/api/listings/${listing.id}`, { method: "PATCH", body: formData });

    setPending(false);
    if (res.ok) {
      router.push(`/annonce/${listing.id}`);
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => null);
    setError(t(ERROR_KEY[data?.error] ?? "errorGeneric"));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {t("resubmissionNotice")}
      </p>

      <div>
        <label htmlFor="edit-category" className="block text-sm font-medium text-slate-700 mb-1">
          {tWizard("category")}
        </label>
        <select
          id="edit-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ListingCategory)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {tWizard(CATEGORY_KEY[c])}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="edit-brand" className="block text-sm font-medium text-slate-700 mb-1">
          {tWizard("brand")}
        </label>
        <select
          id="edit-brand"
          value={brandOther ? "__other__" : (brandId ?? "")}
          onChange={(e) => {
            if (e.target.value === "__other__") {
              setBrandOther(true);
              setModelOther(true);
              setBrandId(undefined);
              setModelId(undefined);
              return;
            }
            setBrandOther(false);
            setModelOther(false);
            setBrandId(Number(e.target.value));
            setModelId(undefined);
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
        >
          <option value="" disabled>
            {tWizard("brandPlaceholder")}
          </option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
          <option value="__other__">{tWizard("brandOther")}</option>
        </select>
      </div>

      {brandOther && (
        <div>
          <label htmlFor="edit-brand-free" className="block text-sm font-medium text-slate-700 mb-1">
            {tWizard("brandFreeText")}
          </label>
          <input
            id="edit-brand-free"
            type="text"
            value={brandFreeText}
            onChange={(e) => setBrandFreeText(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
      )}

      {!brandOther && selectedBrand && (
        <div>
          <label htmlFor="edit-model" className="block text-sm font-medium text-slate-700 mb-1">
            {tWizard("model")}
          </label>
          <select
            id="edit-model"
            value={modelOther ? "__other__" : (modelId ?? "")}
            onChange={(e) => {
              if (e.target.value === "__other__") {
                setModelOther(true);
                setModelId(undefined);
                return;
              }
              setModelOther(false);
              setModelId(Number(e.target.value));
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="" disabled>
              {tWizard("modelPlaceholder")}
            </option>
            {selectedBrand.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            <option value="__other__">{tWizard("modelOther")}</option>
          </select>
        </div>
      )}

      {(brandOther || modelOther) && (
        <div>
          <label htmlFor="edit-model-free" className="block text-sm font-medium text-slate-700 mb-1">
            {tWizard("modelFreeText")}
          </label>
          <input
            id="edit-model-free"
            type="text"
            value={modelFreeText}
            onChange={(e) => setModelFreeText(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
      )}

      <div>
        <label htmlFor="edit-title" className="block text-sm font-medium text-slate-700 mb-1">
          {tWizard("title")}
        </label>
        <input
          id="edit-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="edit-description" className="block text-sm font-medium text-slate-700 mb-1">
          {tWizard("description")}
        </label>
        <textarea
          id="edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={5000}
          rows={6}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="edit-year" className="block text-sm font-medium text-slate-700 mb-1">
            {tWizard("year")}
          </label>
          <input
            id="edit-year"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="edit-mileage" className="block text-sm font-medium text-slate-700 mb-1">
            {tWizard("mileage")}
          </label>
          <input
            id="edit-mileage"
            type="number"
            min={0}
            value={mileage}
            onChange={(e) => setMileage(Number(e.target.value))}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="edit-fuel" className="block text-sm font-medium text-slate-700 mb-1">
            {tWizard("fuelType")}
          </label>
          <select
            id="edit-fuel"
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value as FuelType)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="ESSENCE">{tWizard("fuelEssence")}</option>
            <option value="DIESEL">{tWizard("fuelDiesel")}</option>
            <option value="GPL">{tWizard("fuelGpl")}</option>
            <option value="HYBRIDE">{tWizard("fuelHybride")}</option>
            <option value="ELECTRIQUE">{tWizard("fuelElectrique")}</option>
          </select>
        </div>
        <div>
          <label htmlFor="edit-gearbox" className="block text-sm font-medium text-slate-700 mb-1">
            {tWizard("gearbox")}
          </label>
          <select
            id="edit-gearbox"
            value={gearbox}
            onChange={(e) => setGearbox(e.target.value as Gearbox)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
          >
            <option value="MANUELLE">{tWizard("gearboxManuelle")}</option>
            <option value="AUTOMATIQUE">{tWizard("gearboxAutomatique")}</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="edit-transmission" className="block text-sm font-medium text-slate-700 mb-1">
          {tWizard("transmission")}
        </label>
        <select
          id="edit-transmission"
          value={transmission}
          onChange={(e) => setTransmission(e.target.value as Transmission | "")}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
        >
          <option value="">{tWizard("transmissionNone")}</option>
          <option value="QUATRE_X_DEUX">{tWizard("transmission4x2")}</option>
          <option value="QUATRE_X_QUATRE">{tWizard("transmission4x4")}</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="edit-color" className="block text-sm font-medium text-slate-700 mb-1">
            {tWizard("color")}
          </label>
          <input
            id="edit-color"
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="edit-doors" className="block text-sm font-medium text-slate-700 mb-1">
            {tWizard("doors")}
          </label>
          <input
            id="edit-doors"
            type="number"
            min={1}
            max={7}
            value={doors}
            onChange={(e) => setDoors(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="edit-seats" className="block text-sm font-medium text-slate-700 mb-1">
            {tWizard("seats")}
          </label>
          <input
            id="edit-seats"
            type="number"
            min={1}
            max={9}
            value={seats}
            onChange={(e) => setSeats(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="edit-power" className="block text-sm font-medium text-slate-700 mb-1">
          {tWizard("powerHp")}
        </label>
        <input
          id="edit-power"
          type="number"
          min={1}
          max={2000}
          value={powerHp}
          onChange={(e) => setPowerHp(e.target.value ? Number(e.target.value) : "")}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="edit-condition" className="block text-sm font-medium text-slate-700 mb-1">
          {tWizard("condition")}
        </label>
        <select
          id="edit-condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value as ListingCondition)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
        >
          <option value="NEUF">{tWizard("conditionNeuf")}</option>
          <option value="OCCASION">{tWizard("conditionOccasion")}</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={firstHand} onChange={(e) => setFirstHand(e.target.checked)} />
        {tWizard("firstHand")}
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={accidented} onChange={(e) => setAccidented(e.target.checked)} />
        {tWizard("accidented")}
      </label>

      <div>
        <label htmlFor="edit-wilaya" className="block text-sm font-medium text-slate-700 mb-1">
          {tWizard("wilaya")}
        </label>
        <select
          id="edit-wilaya"
          value={wilayaId}
          onChange={(e) => setWilayaId(Number(e.target.value))}
          className="w-full rounded-md border border-slate-300 px-3 py-2 bg-white"
        >
          {wilayas.map((w) => (
            <option key={w.id} value={w.id}>
              {locale === "ar" ? w.nomAr : w.nomFr}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="block text-sm font-medium text-slate-700 mb-1">{t("photosSectionTitle")}</span>
        <div className="grid grid-cols-3 gap-3">
          {existingPhotos.map((photo, i) => (
            <div key={photo.id} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element -- vignette de gestion, pas un affichage optimisable */}
              <img
                src={photo.path}
                alt={t("photoNumber", { n: i + 1 })}
                className="aspect-square w-full rounded-md object-cover border border-slate-200"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 opacity-0 group-hover:opacity-100 text-white text-xs">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveExistingPhoto(i, -1)}
                    disabled={i === 0}
                    aria-label={t("photoMoveUp")}
                    className="px-1.5 py-0.5 bg-black/40 rounded disabled:opacity-40"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveExistingPhoto(i, 1)}
                    disabled={i === existingPhotos.length - 1}
                    aria-label={t("photoMoveDown")}
                    className="px-1.5 py-0.5 bg-black/40 rounded disabled:opacity-40"
                  >
                    ▼
                  </button>
                </div>
                <button type="button" onClick={() => removeExistingPhoto(i)} className="px-1.5 py-0.5 bg-black/40 rounded">
                  {tWizard("photosRemove")}
                </button>
              </div>
            </div>
          ))}

          {newPhotoPreviews.map((url, i) => (
            <div key={url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local d'un fichier non encore uploadé */}
              <img src={url} alt="" className="aspect-square w-full rounded-md object-cover border border-slate-200" />
              <button
                type="button"
                onClick={() => removeNewPhoto(i)}
                className="absolute top-1 right-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 group-hover:opacity-100"
              >
                {tWizard("photosRemove")}
              </button>
            </div>
          ))}

          {totalPhotoCount < MAX_PHOTOS && (
            <label className="aspect-square flex items-center justify-center rounded-md border-2 border-dashed border-slate-300 text-slate-500 text-sm cursor-pointer hover:border-slate-400">
              {tWizard("photosAdd")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleAddPhotos}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || totalPhotoCount === 0}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {t("submit")}
      </button>
    </form>
  );
}
