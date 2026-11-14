import React, { useEffect, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import { Clock, ExternalLink, MapPin, Navigation, Star } from 'lucide-react';
import type { StoreMapsInfo } from '../types';
import { MEDIA_ASSETS } from '../data/catalogMedia';

const STORE_DEFAULT_COORDS = { lat: 35.6767441, lng: 10.0935975 };
const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

function BoutiqueMarkerWithInfo({
  position,
  title,
  address,
  mapsUri,
}: {
  position: { lat: number; lng: number };
  title: string;
  address: string;
  mapsUri: string;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(true);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={title}
        onClick={() => setOpen((o) => !o)}
      >
        <Pin background="#C5A059" borderColor="#111111" glyphColor="#111111" scale={1.15} />
      </AdvancedMarker>
      {open && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="p-1 max-w-[220px] text-[#111111]">
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-[#4A4946] mt-0.5">{address}</p>
            <a
              href={mapsUri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#8B6B2E] hover:underline mt-1.5"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function InteractiveMapInner({
  center,
  title,
  address,
  mapsUri,
}: {
  center: { lat: number; lng: number };
  title: string;
  address: string;
  mapsUri: string;
}) {
  const status = useApiLoadingStatus();

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#181A1F] text-[#F6F3EC] p-6 text-center">
        <MapPin className="w-8 h-8 text-[#C5A059] mb-2" />
        <p className="font-editorial text-lg">{title}</p>
        <p className="text-xs text-white/70 mt-1 max-w-xs">{address}</p>
        <a
          href={mapsUri}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#C5A059] text-[#111111] text-xs font-semibold uppercase tracking-wider"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Directions on Google Maps</span>
        </a>
      </div>
    );
  }

  return (
    <GoogleMap
      defaultCenter={center}
      defaultZoom={16}
      mapId="DEMO_MAP_ID"
      internalUsageAttributionIds={ATTRIBUTION_IDS}
      gestureHandling="cooperative"
      disableDefaultUI={false}
      style={{ width: '100%', height: '100%' }}
    >
      <BoutiqueMarkerWithInfo
        position={center}
        title={title}
        address={address}
        mapsUri={mapsUri}
      />
    </GoogleMap>
  );
}

export function StoreLocationMap({
  compact = false,
  onQuotaDetected,
}: {
  compact?: boolean;
  onQuotaDetected?: () => void;
}) {
  const [info, setInfo] = useState<StoreMapsInfo | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  useEffect(() => {
    let active = true;
    fetch('/api/store/maps-info')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: StoreMapsInfo | null) => {
        if (!active || !data) return;
        setInfo(data);
        if (data.quotaExceeded) {
          onQuotaDetected?.();
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      })
      .catch(() => {
        // Use resilient defaults below
      });
    return () => {
      active = false;
    };
  }, [onQuotaDetected]);

  const rawLoc = info?.store?.location;
  const center = {
    lat: rawLoc?.lat ?? rawLoc?.latitude ?? STORE_DEFAULT_COORDS.lat,
    lng: rawLoc?.lng ?? rawLoc?.longitude ?? STORE_DEFAULT_COORDS.lng,
  };
  const storeName = info?.store?.name || 'Gentleman Atelier — Kairouan';
  const storeAddress = info?.store?.address || 'Centre Ville, Kairouan 3100, Tunisia';
  const mapsUri = info?.store?.googleMapsUri || 'https://maps.app.goo.gl/kNZD5xJUovHBy7aP6';
  const hasValidKey = Boolean(apiKey && apiKey !== 'MY_GOOGLE_MAPS_API_KEY');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className={`${compact ? 'lg:col-span-7' : 'lg:col-span-7'} border border-[#E6E1D6] bg-white overflow-hidden`}>
        <div className={compact ? 'h-[280px] w-full' : 'h-[380px] w-full'}>
          {hasValidKey ? (
            <APIProvider apiKey={apiKey!}>
              <InteractiveMapInner
                center={center}
                title={storeName}
                address={storeAddress}
                mapsUri={mapsUri}
              />
            </APIProvider>
          ) : (
            <div className="relative w-full h-full bg-[#15181F] text-[#F6F3EC] flex flex-col justify-between p-6">
              <img
                src={MEDIA_ASSETS.boutique_kairouan_atelier}
                alt="Gentleman Atelier boutique interior in Kairouan"
                className="absolute inset-0 w-full h-full object-cover opacity-35"
              />
              <div className="relative z-10 flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-[#C5A059] font-medium">
                  Kairouan Flagship · 35.6767° N, 10.0936° E
                </span>
                <MapPin className="w-5 h-5 text-[#C5A059]" />
              </div>
              <div className="relative z-10">
                <h4 className="font-editorial text-2xl text-white">{storeName}</h4>
                <p className="text-sm text-white/80 mt-1">{storeAddress}</p>
                <a
                  href={mapsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-[#C5A059] text-[#111111] text-xs font-semibold uppercase tracking-wider hover:bg-[#D7B46E] transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Open Live Google Maps</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`${compact ? 'lg:col-span-5' : 'lg:col-span-5'} space-y-5`}>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#8B6B2E] font-medium">
            Kairouan Boutique &amp; Dispatch Hub
          </p>
          <h3 className="font-editorial text-2xl text-[#111111] mt-1">{storeName}</h3>
          <p className="text-sm text-[#5C5953] mt-1">{storeAddress}</p>
          {info?.store?.rating && (
            <div className="flex items-center gap-2 mt-2 text-xs text-[#111111]">
              <Star className="w-3.5 h-3.5 fill-[#C5A059] text-[#C5A059]" />
              <span className="font-semibold tabular-nums">{info.store.rating}</span>
              <span className="text-[#5C5953]">
                · {info.store.userRatingCount ?? 0} Google reviews
              </span>
            </div>
          )}
        </div>

        {/* Store Opening Hours */}
        <div className="border-t border-[#E6E1D6] pt-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#5C5953] mb-2">
            <Clock className="w-3.5 h-3.5 text-[#8B6B2E]" />
            <span>Boutique Hours</span>
          </div>
          <ul className="space-y-1 text-xs text-[#111111] tabular-nums">
            {(info?.store?.openingHours?.length
              ? info.store.openingHours
              : ['Monday - Saturday: 09:30 - 20:30', 'Sunday: 10:00 - 16:00']
            )
              .slice(0, compact ? 3 : 7)
              .map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
          </ul>
        </div>

        {/* Grounded Places Photos or Boutique Gallery */}
        {!compact && (
          <div className="border-t border-[#E6E1D6] pt-4">
            <p className="text-xs uppercase tracking-wider text-[#5C5953] mb-2">
              {info?.photos && info.photos.length > 0 ? 'Google Maps Store Photos' : 'Boutique Gallery'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {info?.photos && info.photos.length > 0 ? (
                info.photos.slice(0, 2).map((photo, idx) => (
                  <div key={idx} className="space-y-1">
                    <img
                      src={photo.url}
                      alt={`Gentleman Kairouan boutique photo ${idx + 1}`}
                      className="w-full h-24 object-cover border border-[#E6E1D6]"
                    />
                    {photo.attributions?.[0] && (
                      <a
                        href={photo.attributions[0].uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[10px] text-[#5C5953] truncate hover:underline"
                      >
                        Photo: {photo.attributions[0].displayName}
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-2">
                  <img
                    src={MEDIA_ASSETS.boutique_kairouan_atelier}
                    alt="Gentleman Kairouan atelier interior"
                    className="w-full h-32 object-cover border border-[#E6E1D6]"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grounding Summary & Required Grounding Links */}
        {info?.groundingSummary && !compact && (
          <p className="text-xs text-[#5C5953] leading-relaxed border-t border-[#E6E1D6] pt-3">
            {info.groundingSummary}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          {(info?.groundingLinks?.length
            ? info.groundingLinks
            : [{ title: 'Gentleman Kairouan on Google Maps', uri: mapsUri }]
          ).map((link, idx) => (
            <a
              key={idx}
              href={link.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#111111] border-b border-[#C5A059] pb-0.5 hover:text-[#8B6B2E]"
            >
              <span>{link.title}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
