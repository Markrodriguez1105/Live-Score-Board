import { Crown } from "lucide-react";

export default function Logo({ size = 16 }: { size?: number }) {
    return (
        <div className="flex items-center justify-center">
            <div className="flex items-center bg-primary rounded-2xl">
                <Crown className="p-2" size={size} />
            </div>
        </div>
    )
}