import Header from '@/components/layout/Header';
import SignupForm from './SignupForm';

export default function SignupPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />

            <main className="flex-grow flex items-center justify-center pt-20 px-6">
                <SignupForm />
            </main>
        </div>
    );
}
