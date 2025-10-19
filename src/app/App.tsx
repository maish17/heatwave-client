import React from "react";
import "maplibre-gl/dist/maplibre-gl.css";

import Navbar from "../components/layout/Header";
import MapView from "../components/map/MapCanvas/MapView";

export default function App() {
  return (
    <div>
      <Navbar />
      <MapView />
    </div>
  );
}
