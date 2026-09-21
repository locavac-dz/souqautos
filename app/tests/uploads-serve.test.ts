import path from "node:path";
import { describe, expect, it } from "vitest";
import { UPLOAD_SUBDIRS, resolveUploadFile, uploadEtag } from "@/lib/uploads-serve";

// Lot 147 — quel fichier une adresse `/uploads/<dossier>/<fichier>` peut-elle désigner ? C'est ce qui sépare « servir une photo » de « servir
// n'importe quel fichier du serveur » : chaque piège classique est posé ici.

const ROOT = path.resolve("/srv/app/public/uploads");
const UUID = "3f9c1e0a-5b7d-4c2e-9a10-abcdef123456";

describe("resolveUploadFile — ce qui est servi", () => {
  it("une photo ordinaire de chaque dossier que le site écrit", () => {
    for (const subdir of UPLOAD_SUBDIRS) {
      const target = resolveUploadFile(ROOT, [subdir, `${UUID}.jpg`]);
      expect(target, subdir).toEqual({ file: path.join(ROOT, subdir, `${UUID}.jpg`), contentType: "image/jpeg" });
    }
  });

  it("le type est celui de l'extension, sans tenir compte de la casse", () => {
    expect(resolveUploadFile(ROOT, ["listings", "a.JPG"])?.contentType).toBe("image/jpeg");
    expect(resolveUploadFile(ROOT, ["listings", "a.jpeg"])?.contentType).toBe("image/jpeg");
    expect(resolveUploadFile(ROOT, ["listings", "a.png"])?.contentType).toBe("image/png");
    expect(resolveUploadFile(ROOT, ["listings", "a.webp"])?.contentType).toBe("image/webp");
    expect(resolveUploadFile(ROOT, ["listings", "demo-photo_2.v1.jpg"])?.contentType).toBe("image/jpeg"); // noms de démonstration
  });

  it("les dossiers servis sont exactement ceux où le site écrit (src/lib/uploads.ts) : ni plus, ni moins", () => {
    expect([...UPLOAD_SUBDIRS].sort()).toEqual(["avatars", "blog-covers", "listings", "messages", "pro-banners", "pro-logos"]);
  });
});

describe("resolveUploadFile — ce qui n'est JAMAIS servi", () => {
  const refused = (segments: string[], why: string) => expect(resolveUploadFile(ROOT, segments), why).toBeNull();

  it("la remontée de dossier, sous toutes ses formes", () => {
    refused(["..", "secret.jpg"], "dossier « .. »");
    refused(["listings", ".."], "fichier « .. »");
    refused(["listings", "..", "..", ".env"], "trop de segments");
    refused(["listings", "../secret.jpg"], "séparateur dans le nom");
    refused(["listings", "..\\secret.jpg"], "séparateur Windows dans le nom");
    refused(["listings/../..", "secret.jpg"], "séparateur dans le dossier");
    refused(["listings", "a..b.jpg"], "deux points consécutifs");
    refused(["listings", "%2e%2e%2fsecret.jpg"], "séparateur encodé (« % » n'est pas un caractère de nom)");
    refused(["listings", "..%2f..%2fsecret.jpg"], "remontée encodée");
    refused(["listings", "....//secret.jpg"], "variante de remontée");
  });

  it("un chemin absolu, un lecteur Windows, un octet nul, un espace, un caractère exotique", () => {
    refused(["/etc", "passwd.jpg"], "dossier absolu");
    refused(["listings", "/etc/passwd.jpg"], "fichier absolu");
    refused(["listings", "C:\\Windows\\win.jpg"], "chemin Windows");
    refused(["listings", "C:secret.jpg"], "lecteur Windows (deux-points)");
    refused(["listings", "a.jpg\u0000.txt"], "octet nul");
    refused(["listings", "a b.jpg"], "espace");
    refused(["listings", "é.jpg"], "caractère non ASCII");
    refused(["listings", "a.jpg?x=1"], "paramètre d'adresse");
    refused(["listings", "a.jpg#x"], "ancre");
    refused(["listings", "a.jpg\n"], "retour à la ligne");
  });

  it("un fichier caché, un nom vide ou démesuré", () => {
    refused(["listings", ".htaccess.jpg"], "commence par un point");
    refused(["listings", ".jpg"], "extension seule");
    refused(["listings", ""], "nom vide");
    refused(["listings", "a".repeat(400) + ".jpg"], "nom démesuré");
    refused(["listings", "-a.jpg"], "commence par un tiret");
  });

  it("un dossier qui n'est pas de ceux que le site écrit — notamment les pièces d'identité et tout ce qui est privé", () => {
    for (const subdir of ["identity", "identity-uploads", "private", "backups", "secrets", "logs", "..", ".", "", "Listings", "LISTINGS", "listing", "listings ", "listings.", "avatars2"]) {
      refused([subdir, `${UUID}.jpg`], `dossier « ${subdir} »`);
    }
  });

  it("une extension qui n'est pas une image : script, page, vecteur, archive, fichier de configuration", () => {
    for (const name of ["a.svg", "a.html", "a.htm", "a.js", "a.mjs", "a.php", "a.exe", "a.txt", "a.json", "a.env", "a.pdf", "a.zip", "a.gif", "a", "a.", "a.jpg.html", "a.jpg.svg", "a.jpg.", "a.jpgx"]) {
      refused(["listings", name], `extension de « ${name} »`);
    }
  });

  it("une profondeur qui n'est pas exactement <dossier>/<fichier> : pas de sous-dossier libre, pas de dossier seul", () => {
    refused([], "aucun segment");
    refused(["listings"], "un dossier seul (liste du contenu)");
    refused(["listings", "sub", `${UUID}.jpg`], "sous-dossier");
    refused(["listings", "a", "b", "c.jpg"], "quatre segments");
    // Le piège subtil : un DEUXIÈME segment valide suivi d'autres. Servir « listings/<photo> » en ignorant la suite ferait répondre une
    // adresse qui n'est pas celle d'une photo — et ouvrirait la porte à toute confusion de chemin.
    refused(["listings", `${UUID}.jpg`, "extra"], "segment en trop après une photo valide");
    refused(["listings", `${UUID}.jpg`, "..", "..", "secret.jpg"], "remontée après une photo valide");
  });

  it("un dossier de départ qui contient déjà le nom du dossier voisin ne fait pas sortir de son dossier", () => {
    // La comparaison se fait sur le dossier AVEC son séparateur final : « …/listings-evil » ne commence pas par « …/listings/ ».
    const target = resolveUploadFile(ROOT, ["listings", `${UUID}.jpg`]);
    expect(target?.file.startsWith(path.join(ROOT, "listings") + path.sep)).toBe(true);
  });
});

describe("uploadEtag", () => {
  it("est stable pour un même fichier, et change dès que la taille ou la date change", () => {
    expect(uploadEtag(1234, 1_700_000_000_000)).toBe(uploadEtag(1234, 1_700_000_000_000));
    expect(uploadEtag(1234, 1_700_000_000_000)).not.toBe(uploadEtag(1235, 1_700_000_000_000));
    expect(uploadEtag(1234, 1_700_000_000_000)).not.toBe(uploadEtag(1234, 1_700_000_000_001));
  });

  it("est une valeur d'ETag valide : entre guillemets, sans caractère qui casserait un en-tête", () => {
    expect(uploadEtag(14587, 1_758_000_000_123.9)).toMatch(/^"[0-9a-f]+-[0-9a-f]+"$/);
  });
});
