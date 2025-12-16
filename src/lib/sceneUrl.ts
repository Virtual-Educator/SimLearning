import { supabase } from './supabaseClient';

type SceneStorageLocation = {
  bucket: string;
  path: string;
};

type SceneWithStorage = {
  type: string;
  src?: string;
  image_path?: string;
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

export async function resolveSceneImageUrl(
  manifest: unknown
): Promise<{ url: string; source: 'storage' | 'public' } | null> {
  if (!isRecord(manifest)) return null;

  const manifestWithScene = manifest as ManifestWithScene;
  const scene = manifestWithScene.scene;

  if (hasStorageLocation(scene)) {
    const { data, error } = await supabase.storage.from(scene.storage.bucket).createSignedUrl(scene.storage.path, 3600);

    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? 'Unable to generate signed URL for scene image.');
    }

    return { url: data.signedUrl, source: 'storage' };
  }

  const publicPath = resolvePublicPath(manifestWithScene);
  if (publicPath) {
    return { url: publicPath, source: 'public' };
  }

  return null;
}
