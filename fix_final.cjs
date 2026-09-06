const fs = require('fs');

// We have the code exactly as it was when we started, EXCEPT `GeometryControl.tsx` has been changed back to the proper UI hint.
// Wait, is it?
// Let's check `GeometryControl.tsx`'s content to ensure it says `resistor on a short bridge wire`.
const uiContent = fs.readFileSync('src/components/Panel/GeometryControl.tsx', 'utf8');
if (uiContent.includes('resistor on a short bridge wire spanning the gap at the centre of the base (not to ground)')) {
    console.log("UI is correct.");
} else {
    console.log("UI is wrong!");
}

const geoContent = fs.readFileSync('src/store/antennaStore.ts', 'utf8');
if (geoContent.includes('TERMINATED_DELTA_BRIDGE_TAG')) {
    console.log("Store has bridge topology.");
} else {
    console.log("Store has stub topology!");
}
