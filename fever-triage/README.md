# AI Fever Triage System - Frontend

## 🩺 AI-Powered Fever Triage System
*Intelligent Emergency Decision Support*

A production-ready Next.js 14 application that provides AI-powered fever diagnostics and triage assessments using OpenAI's GPT-4, designed for healthcare professionals and emergency decision support.

## 🚀 Features

🎯 **Instant AI Triage**: Get immediate severity classifications (LOW/MEDIUM/HIGH/CRITICAL)  
🩺 **Clinical Decision Support**: Evidence-based assessments using ER protocols  
📱 **Responsive Design**: Mobile-first interface optimized for all devices  
⚡ **Real-time Analysis**: Fast API integration with loading states  
🎨 **Healthcare UI**: Professional medical interface with color-coded severity levels  
📋 **Demo Cases**: Pre-configured scenarios for quick testing  
🛡️ **Safety First**: Always prioritizes patient safety with emergency protocols  

## 🔧 Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React + Emojis
- **State Management**: React Hooks
- **API Client**: Custom fetch-based client
- **Deployment**: Vercel

## 📁 Project Structure

```
fever-triage/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Main triage interface
│   └── globals.css         # Global styles and Tailwind imports
├── components/
│   ├── SymptomForm.tsx     # Patient data input form
│   ├── ResultsDisplay.tsx  # Triage results display
│   └── DemoCases.tsx       # Quick demo case buttons
├── lib/
│   └── api.ts              # API client and TypeScript interfaces
├── public/                 # Static assets
├── package.json            # Dependencies and scripts
├── tailwind.config.js      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
├── next.config.js          # Next.js configuration
└── vercel.json             # Vercel deployment config
```

## 🛠️ Local Development Setup

### Prerequisites
- Node.js 18+ and npm
- Git

### Installation

1. **Navigate to the frontend directory**
```bash
cd fever-triage
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
# Copy the template
cp .env.local.example .env.local

# Edit .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

4. **Run the development server**
```bash
npm run dev
```

5. **Open your browser**
- Frontend: http://localhost:3000
- Make sure the backend is running on port 8000

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## 🎯 Component Architecture

### Main Page (`app/page.tsx`)
- Main application orchestrator
- Handles state management between form and results
- Error handling and loading states
- Demo case integration

### SymptomForm (`components/SymptomForm.tsx`)
- Patient data input with validation
- 20 common symptoms with multi-select
- Temperature, age, and duration inputs
- Medical history textarea
- Form validation with error display

### ResultsDisplay (`components/ResultsDisplay.tsx`)
- Color-coded severity badges
- Collapsible clinical explanation
- Red flags and warning signs
- Emergency action buttons
- Medical disclaimer

### DemoCases (`components/DemoCases.tsx`)
- Pre-configured test scenarios
- Quick form population
- Visual severity indicators

### API Client (`lib/api.ts`)
- TypeScript interfaces for all data types
- Error handling with custom APIError class
- Environment-based URL configuration

## 🎨 Design System

### Color Palette
- **Primary**: Blue (#3B82F6) - Trust and medical professionalism
- **Low Severity**: Green (#10B981) - Safe, manageable
- **Medium Severity**: Yellow (#F59E0B) - Caution, monitor
- **High Severity**: Orange (#F97316) - Urgent attention needed
- **Critical Severity**: Red (#EF4444) - Emergency, immediate action

### Typography
- **Font**: Inter (Google Fonts)
- **Headers**: Bold, blue-900
- **Body**: Regular, gray-700
- **Disclaimers**: Small, gray-600

### Layout
- **Mobile-first**: Responsive design starting from 320px
- **Containers**: Max-width constraints for readability
- **Spacing**: Consistent 8px grid system
- **Cards**: Subtle shadows and rounded corners

## 🔌 API Integration

### Endpoints Used
- `POST /api/triage` - Submit patient data for assessment
- `GET /api/health` - Backend health check

### Request Format
```typescript
interface PatientData {
  temperature: number;        // 95.0 - 110.0 Fahrenheit
  duration_hours: number;     // 1 - 720 hours
  symptoms: string[];         // Array of symptom names
  age: number;               // 0 - 120 years
  medical_history?: string;   // Optional medical history
}
```

### Response Format
```typescript
interface TriageResponse {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  diagnosis_suggestions: string[];
  recommended_action: string;
  clinical_explanation: string;
  red_flags: string[];
  confidence_score: number;   // 0.0 - 1.0
}
```

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Connect to Vercel**
   - Import your repository to Vercel
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`

2. **Environment Variables**
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.com
   ```

3. **Deploy**
   - Automatic deployments on git push
   - Preview deployments for pull requests

### Manual Deployment

1. **Build the application**
```bash
npm run build
```

2. **Start production server**
```bash
npm start
```

## 📊 Demo Cases

The application includes 4 pre-configured demo cases:

1. **Common Cold** - Low severity viral infection
2. **Flu** - Medium severity influenza symptoms  
3. **Pneumonia** - High severity bacterial infection
4. **Critical Sepsis** - Critical emergency condition

## 🛡️ Safety Features

- **Emergency Button**: Always-visible 911 call button
- **Medical Disclaimers**: Clear warnings throughout interface
- **Critical Alerts**: Special handling for critical cases
- **Input Validation**: Prevents invalid medical data
- **Error Handling**: Graceful failure with user guidance

## 🔍 Testing

### Manual Testing Checklist
- [ ] Form validation works for all inputs
- [ ] Demo cases populate form correctly
- [ ] Loading states display during API calls
- [ ] Error messages appear for API failures
- [ ] Results display with proper severity colors
- [ ] Mobile responsiveness on various screen sizes
- [ ] Emergency buttons work (call functionality)

## 🐛 Common Issues

### \"API Connection Failed\"
- Check if backend is running on correct port
- Verify NEXT_PUBLIC_API_URL in .env.local
- Check CORS settings in backend

### \"Build Errors\"
- Run `npm install` to ensure all dependencies
- Check TypeScript errors with `npm run lint`
- Verify all imports are correct

### \"Styling Issues\"
- Ensure Tailwind CSS is properly configured
- Check if PostCSS is processing correctly
- Verify class names are valid Tailwind classes

## 🔮 Future Enhancements

- 🌍 **Multi-language Support**: Internationalization for global use
- 📱 **PWA Features**: Offline capability and app installation
- 🔊 **Accessibility**: WCAG 2.1 AA compliance
- 📈 **Analytics**: User behavior tracking and insights
- 🔐 **Authentication**: User accounts and session management
- 💾 **Data Persistence**: Save assessments and patient history

## 📝 Medical Disclaimer

⚠️ **IMPORTANT**: This application is for educational and demonstration purposes only. It is not intended to replace professional medical advice, diagnosis, or treatment. Always seek the advice of qualified healthcare providers with any questions regarding medical conditions. In case of medical emergency, call 911 immediately.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏥 Healthcare Compliance Note

This system is designed for educational purposes and should undergo proper clinical validation, regulatory review, and compliance verification before any real-world medical use.
