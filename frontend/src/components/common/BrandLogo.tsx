import Image from "next/image";

export default function BrandLogo() {
  return (
    <span className="flex items-center gap-3">
      <Image
        src="/images/credential-management-logo.png"
        alt=""
        width={48}
        height={38}
        priority
        className="h-9 w-auto shrink-0"
      />
      <span className="hidden text-sm font-semibold leading-tight text-white sm:block md:text-base">
        Credential Management System
      </span>
    </span>
  );
}
