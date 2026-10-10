"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  categoryInfo,
  formatAddress,
  type OsmResult,
  type PlaceView,
} from "@/lib/places/types";

interface PlacesMapProps {
  places: PlaceView[];
  draft: OsmResult | null;
  focusUri: string | null;
  onSelect: (uri: string) => void;
  onViewboxChange: (viewbox: string) => void;
}

const DEFAULT_CENTER: L.LatLngTuple = [48.8566, 2.3522]; // Paris

function emojiIcon(emoji: string, highlight = false) {
  return L.divIcon({
    html: `<span style="font-size:22px;line-height:1">${emoji}</span>`,
    className: highlight
      ? "places-marker places-marker--draft"
      : "places-marker",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -14],
  });
}

// Built with DOM APIs (not HTML strings) so record content can't inject markup.
function popupContent(name: string, lines: string[]) {
  const el = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = name;
  el.appendChild(title);
  for (const line of lines.filter(Boolean)) {
    const p = document.createElement("div");
    p.textContent = line;
    el.appendChild(p);
  }
  return el;
}

export default function PlacesMap({
  places,
  draft,
  focusUri,
  onSelect,
  onViewboxChange,
}: PlacesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const placesLayerRef = useRef<L.LayerGroup | null>(null);
  const draftLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const fittedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const onViewboxRef = useRef(onViewboxChange);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onViewboxRef.current = onViewboxChange;
  });

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    placesLayerRef.current = L.layerGroup().addTo(map);
    draftLayerRef.current = L.layerGroup().addTo(map);

    const reportViewbox = () => {
      const b = map.getBounds();
      onViewboxRef.current(
        [b.getWest(), b.getNorth(), b.getEast(), b.getSouth()]
          .map((n) => n.toFixed(5))
          .join(","),
      );
    };
    map.on("moveend", reportViewbox);
    reportViewbox();
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      fittedRef.current = false;
    };
  }, []);

  // Sync saved place markers.
  useEffect(() => {
    const map = mapRef.current;
    const layer = placesLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markersRef.current.clear();

    for (const p of places) {
      const info = categoryInfo(p.category);
      const marker = L.marker([Number(p.latitude), Number(p.longitude)], {
        icon: emojiIcon(info.emoji),
        title: p.name,
      })
        .bindPopup(
          popupContent(p.name, [
            info.label,
            formatAddress(p.address),
            p.tags.map((t) => `#${t}`).join(" "),
          ]),
        )
        .on("click", () => onSelectRef.current(p.uri));
      marker.addTo(layer);
      markersRef.current.set(p.uri, marker);
    }

    if (!fittedRef.current && places.length > 0) {
      fittedRef.current = true;
      map.fitBounds(
        L.latLngBounds(
          places.map((p) => [Number(p.latitude), Number(p.longitude)]),
        ),
        { padding: [40, 40], maxZoom: 15 },
      );
    }
  }, [places]);

  // Show the OSM search result being added.
  useEffect(() => {
    const map = mapRef.current;
    const layer = draftLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!draft) return;
    const pos: L.LatLngTuple = [Number(draft.latitude), Number(draft.longitude)];
    L.marker(pos, { icon: emojiIcon(categoryInfo(draft.category).emoji, true) })
      .bindPopup(popupContent(draft.name, [draft.displayName]))
      .addTo(layer)
      .openPopup();
    map.setView(pos, Math.max(map.getZoom(), 16));
  }, [draft]);

  // Pan to a place picked from the list.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusUri) return;
    const marker = markersRef.current.get(focusUri);
    if (!marker) return;
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 16));
    marker.openPopup();
  }, [focusUri]);

  return <div ref={containerRef} className="h-full w-full" />;
}
