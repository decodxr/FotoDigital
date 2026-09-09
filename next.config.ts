import type {NextConfig} from 'next';
import {securityHeaders} from './lib/shared/headers';
const nextConfig:NextConfig={poweredByHeader:false,async headers(){return [{source:'/:path*',headers:Object.entries(securityHeaders).map(([key,value])=>({key,value}))}];}};
export default nextConfig;
