export interface FeedpointProps {
  position: [number, number, number];
  color: string;
}

export function Feedpoint({ position, color }: FeedpointProps) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.22, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.4}
      />
    </mesh>
  );
}
