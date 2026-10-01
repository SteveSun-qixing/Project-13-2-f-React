// GIS 依赖的引擎内最小类型面：GeoJSON（RFC 7946）宽松结构，只声明引擎读取路径消费的字段。
// shpjs 与 @mapbox/togeojson 上游不携带完整类型声明，本文件是对其公开行为的契约化描述。

interface OfvGeoJsonGeometryLike {
  type?: string | undefined;
  coordinates?: unknown;
  geometries?: OfvGeoJsonGeometryLike[] | undefined;
}

interface OfvGeoJsonFeatureLike {
  type?: string | undefined;
  properties?: Record<string, unknown> | null | undefined;
  geometry?: OfvGeoJsonGeometryLike | null | undefined;
  features?: OfvGeoJsonLike[] | undefined;
}

type OfvGeoJsonLike = OfvGeoJsonFeatureLike;

declare module "shpjs" {
  function shp(
    data: ArrayBuffer | string | { shp: ArrayBuffer; dbf?: ArrayBuffer; shx?: ArrayBuffer; prj?: ArrayBuffer }
  ): Promise<OfvGeoJsonLike | OfvGeoJsonLike[]>;
  export default shp;
}

declare module "@mapbox/togeojson" {
  export function kml(doc: Document): OfvGeoJsonLike;
  export function gpx(doc: Document): OfvGeoJsonLike;
}
