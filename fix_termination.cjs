const fs = require('fs');

let content = fs.readFileSync('src/components/Panel/GeometryControl.tsx', 'utf8');

// Update useShallow in TerminationControl to only return actual aperture and wireRadius if it is a folded dipole
// This will prevent re-renders of TerminationControl when wireRadius changes but we're not on a folded dipole.
content = content.replace(
  /useShallow\(\(s\) => \(\{\s*antennaType: s\.antennaType,\s*terminatingResistor: s\.terminatingResistor,\s*setTerminatingResistor: s\.setTerminatingResistor,\s*foldedDipoleAperture: s\.foldedDipoleAperture,\s*wireRadius: s\.wireRadius,\s*\}\)\)/,
  `useShallow((s) => ({
      antennaType: s.antennaType,
      terminatingResistor: s.terminatingResistor,
      setTerminatingResistor: s.setTerminatingResistor,
      foldedDipoleAperture: s.antennaType === 'folded-dipole' ? s.foldedDipoleAperture : 0,
      wireRadius: s.antennaType === 'folded-dipole' ? s.wireRadius : 0,
    }))`
);


fs.writeFileSync('src/components/Panel/GeometryControl.tsx', content);
