import { supabase } from './supabaseClient';

type SceneStorageLocation = {
  bucket: string;
  path: string;
};

type SceneWithStorage = {
  type: string;
  src?: string;
  image_path?: string;
  entry?: string;
  storage?: SceneStorageLocation;
};

type ManifestWithScene = {
  id?: string;
  scene?: SceneWithStorage;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasStorageLocation(scene: SceneWithStorage | undefined): scene is SceneWithStorage & {
  storage: SceneStorageLocation;
} {
  return Boolean(scene?.storage && scene.storage.bucket && scene.storage.path);
}

function resolvePublicPath(manifest: ManifestWithScene): string | null {
  const publicSrc = manifest.scene?.src ?? manifest.scene?.image_path;
  if (!publicSrc) return null;

  const basePath = manifest.id ? `/simulations/${manifest.id}/` : '';
  return `${basePath}${publicSrc.replace(/^\/+/, '')}`;
}

function normalizePathSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function resolvePackageEntryPath(scene: SceneWithStorage | undefined, packagePath?: string | null): string | null {
  if (!scene?.entry || !packagePath) return null;

  const normalizedPackage = normalizePathSegment(packagePath);
  const normalizedEntry = normalizePathSegment(scene.entry);

  if (!normalizedPackage || !normalizedEntry) return null;

  return `${normalizedPackage}/${normalizedEntry}`;
}

async function createSignedUrl(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Unable to generate signed URL for scene image.');
  }

  return data.signedUrl;
}

export async function resolveSceneImageUrl(
  manifest: unknown,
  packagePath?: string | null
): Promise<{ url: string; source: 'storage' | 'public' } | null> {
  if (!isRecord(manifest)) return null;

  const manifestWithScene = manifest as ManifestWithScene;
  const scene = manifestWithScene.scene;

  if (hasStorageLocation(scene)) {
    const signedUrl = await createSignedUrl(scene.storage.bucket, scene.storage.path);
    return { url: signedUrl, source: 'storage' };
  }

  const packageEntryPath = resolvePackageEntryPath(scene, packagePath);
  if (packageEntryPath) {
    const signedUrl = await createSignedUrl('simulations', packageEntryPath);
    return { url: signedUrl, source: 'storage' };
  }

  const publicPath = resolvePublicPath(manifestWithScene);
  if (publicPath) {
    return { url: publicPath, source: 'public' };
  }

  return null;
}
