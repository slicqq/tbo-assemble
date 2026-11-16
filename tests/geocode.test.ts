import assert from "node:assert/strict";
import { GET } from "../src/app/api/geocode/route";
import { NextRequest } from "next/server";

async function runTests() {
  console.log("Running Geocode API and Map Coordinate Tests...");

  // 1. Missing query parameter should return 400
  const reqMissing = new NextRequest("http://localhost:3000/api/geocode");
  const resMissing = await GET(reqMissing);
  assert.equal(resMissing.status, 400);
  const dataMissing = await resMissing.json();
  assert.ok(dataMissing.error, "Should have error message");

  // 2. Known destination query should resolve coordinates
  const reqBengaluru = new NextRequest(
    "http://localhost:3000/api/geocode?q=The+Leela+Palace%2C+Bengaluru%2C+Karnataka"
  );
  const resBengaluru = await GET(reqBengaluru);
  assert.equal(resBengaluru.status, 200);
  const dataBengaluru = await resBengaluru.json();
  assert.ok(typeof dataBengaluru.lat === "number", "Latitude should be a number");
  assert.ok(typeof dataBengaluru.lng === "number", "Longitude should be a number");
  assert.ok(dataBengaluru.lat >= -90 && dataBengaluru.lat <= 90, "Latitude within range");
  assert.ok(dataBengaluru.lng >= -180 && dataBengaluru.lng <= 180, "Longitude within range");

  // 3. Cache test: second call with same query should return cached result
  const resCached = await GET(reqBengaluru);
  assert.equal(resCached.status, 200);
  const dataCached = await resCached.json();
  assert.equal(dataCached.lat, dataBengaluru.lat);
  assert.equal(dataCached.lng, dataBengaluru.lng);
  assert.equal(dataCached.source, "cache");

  // 4. Test fallback to known destinations
  const reqGoa = new NextRequest("http://localhost:3000/api/geocode?q=Taj+Exotica%2C+Goa");
  const resGoa = await GET(reqGoa);
  assert.equal(resGoa.status, 200);
  const dataGoa = await resGoa.json();
  assert.ok(typeof dataGoa.lat === "number");
  assert.ok(typeof dataGoa.lng === "number");

  console.log("✔ All Geocode API and coordinate tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
