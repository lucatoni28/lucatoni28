import {
  VertexBuffer,
  Texture,
  Color3,
  VertexData,
  type Scene,
  StandardMaterial,
  TransformNode,
  Mesh,
} from '../../libs/babylon/exports';
import { CustomMaterial } from '@babylonjs/materials/custom/customMaterial';
import { BMD } from '.';
import { getEmptyTexture } from '../../libs/babylon/emptyTexture';
import { resolveUrlToDataFolder } from '../resolveUrlToDataFolder';

const MAX_BONES = 64;

export function createCustomMaterial(
  scene: Scene,
  name = 'TexturesAtlasMaterial'
) {
  const mat = new CustomMaterial(name, scene);
  mat.fogEnabled = false;
  mat.backFaceCulling = true;
  mat.cullBackFaces = false;
  mat.transparencyMode = 1;
  mat.useAlphaFromDiffuseTexture = false;
  mat.specularColor = Color3.Black();

  mat.AddAttribute(VertexBuffer.UV2Kind);
  mat.AddUniform(`bonesArray[${MAX_BONES}]`, 'mat4', undefined);

  mat.Vertex_After_WorldPosComputed(`
    float boneIndexFloat = uv2.x;
    int boneIndex = int(boneIndexFloat);
    finalWorld = world * bonesArray[boneIndex];
     worldPos = finalWorld*vec4(positionUpdated, 1.0);
     normalWorld = mat3(finalWorld);
    // vNormalW = normalize(normalWorld*normalUpdated);
    vNormalW = normalize(normalWorld*vec3(0.0,0.0,0.5));
  `);

  // let time = 0;
  // scene.onReadyObservable.addOnce(() => {
  // scene.onBeforeRenderObservable.add(() => {
  //   time += scene.getEngine()!.getDeltaTime()! / 1000;
  // });

  mat.onBindObservable.add(ev => {
    const effect = mat.getEffect();
    if (!effect) return;
    // effect.setFloat('time', time);
    const array = ev.metadata?.array;
    if (!array || array.length === 0) return;
    effect.setMatrices('bonesArray', array);
  });
  // });

  mat.unfreeze();

  return mat;
}

const materialCache: Record<string, StandardMaterial> = {};

function getMaterial(
  bmd: BMD,
  meshIndex: number,
  scene: Scene,
  mesh: BMD['Meshes'][number]
) {
  const uniqName = bmd.Name + '_mesh' + meshIndex;
  // const uniqName = '_mat_';

  if (materialCache[uniqName]) return materialCache[uniqName];

  const m = createCustomMaterial(scene);
  m.name = uniqName;
  m.diffuseTexture = getEmptyTexture(scene);
  m.emissiveTexture = getEmptyTexture(scene);

  const textureName = mesh.TexturePath.replace('.JPG', '.jpg');

  const textureFilePath = resolveUrlToDataFolder(bmd.Dir + textureName);

  if (textureName.toLowerCase().endsWith('.tga')) {
    const t = new Texture(textureFilePath, scene, true, false);
    t.hasAlpha = true;
    t.anisotropicFilteringLevel = 1;
    m.diffuseTexture = t;
    m.transparencyMode = 2;
    m.useAlphaFromDiffuseTexture = true;
  } else {
    const t = new Texture(textureFilePath, scene, true, false);
    t.anisotropicFilteringLevel = 1;
    m.diffuseTexture = t;
  }

  materialCache[uniqName] = m;

  return m;
}

export function createMeshesForBMD(
  scene: Scene,
  bmd: BMD,
  parent: TransformNode
) {
  return bmd.Meshes.map((mesh, meshIndex) => {
    const customMesh = new Mesh(bmd.Name + '_mesh' + meshIndex, scene);

    customMesh.isPickable = false;

    // customMesh.showBoundingBox = true;

    customMesh.setParent(parent);

    customMesh.scaling.setAll(1);

    customMesh.position.setAll(0);
    customMesh.rotationQuaternion = null;
    customMesh.rotation.setAll(0);
    customMesh.metadata = {
      array: [],
    };

    const positions: number[] = []; //vec3
    const indices: number[] = []; //float
    const uvs: number[] = []; //vec2
    const normals: number[] = []; //vec3
    const colors: number[] = []; //vec4
    const boneIndex: number[] = [];

    let pi = 0;

    for (let i = 0; i < mesh.Triangles.length; i++) {
      const triangle = mesh.Triangles[i];

      for (let j = 0; j < triangle.Polygon; j++) {
        const vertexIndex = triangle.VertexIndex[j];
        const vertex = mesh.Vertices[vertexIndex];

        const normalIndex = triangle.NormalIndex[j];
        const normal = mesh.Normals[normalIndex].Normal;
        const coordIndex = triangle.TexCoordIndex[j];
        const texCoord = mesh.TexCoords[coordIndex];

        const pos = vertex.Position;

        indices.push(pi);
        positions.push(pos.x, pos.y, pos.z);
        normals.push(normal.x, normal.y, normal.z);
        uvs.push(texCoord.U, texCoord.V);
        colors.push(1, 1, 1, 1);

        boneIndex.push(vertex.Node, 0);

        pi++;
      }
    }

    const vertexData = new VertexData();

    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.uvs = uvs;
    vertexData.uvs2 = boneIndex;
    vertexData.colors = colors;

    vertexData.applyToMesh(customMesh, false);

    customMesh.material = getMaterial(bmd, meshIndex, scene, mesh);

    return customMesh;
  });
}
