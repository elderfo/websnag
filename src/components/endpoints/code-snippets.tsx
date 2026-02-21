'use client'

import { useState } from 'react'
import { CopyButton } from '@/components/ui/copy-button'

type Language = 'shell' | 'python' | 'javascript' | 'go' | 'ruby' | 'php' | 'java' | 'csharp'

interface CodeSnippetsProps {
  endpointUrl: string
}

interface LanguageTab {
  id: Language
  label: string
}

const LANGUAGES: LanguageTab[] = [
  { id: 'shell', label: 'cURL' },
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'go', label: 'Go' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'php', label: 'PHP' },
  { id: 'java', label: 'Java' },
  { id: 'csharp', label: 'C#' },
]

function getSnippet(language: Language, url: string): string {
  switch (language) {
    case 'shell':
      return [
        `curl -X POST ${url} \\`,
        '  -H "Content-Type: application/json" \\',
        '  -d \'{"event": "test", "data": {"id": 123}}\'',
      ].join('\n')

    case 'python':
      return [
        'import requests',
        '',
        'response = requests.post(',
        `    "${url}",`,
        '    json={"event": "test", "data": {"id": 123}},',
        ')',
        '',
        'print(response.status_code)',
        'print(response.json())',
      ].join('\n')

    case 'javascript':
      return [
        `const response = await fetch("${url}", {`,
        '  method: "POST",',
        '  headers: {',
        '    "Content-Type": "application/json",',
        '  },',
        '  body: JSON.stringify({',
        '    event: "test",',
        '    data: { id: 123 },',
        '  }),',
        '});',
        '',
        'const data = await response.json();',
        'console.log(response.status, data);',
      ].join('\n')

    case 'go':
      return [
        'package main',
        '',
        'import (',
        '\t"bytes"',
        '\t"encoding/json"',
        '\t"fmt"',
        '\t"net/http"',
        ')',
        '',
        'func main() {',
        '\tpayload := map[string]interface{}{',
        '\t\t"event": "test",',
        '\t\t"data":  map[string]interface{}{"id": 123},',
        '\t}',
        '\tbody, err := json.Marshal(payload)',
        '\tif err != nil {',
        '\t\tfmt.Println("Error marshaling JSON:", err)',
        '\t\treturn',
        '\t}',
        '',
        '\tresp, err := http.Post(',
        `\t\t"${url}",`,
        '\t\t"application/json",',
        '\t\tbytes.NewBuffer(body),',
        '\t)',
        '\tif err != nil {',
        '\t\tfmt.Println("Error:", err)',
        '\t\treturn',
        '\t}',
        '\tdefer resp.Body.Close()',
        '',
        '\tfmt.Println("Status:", resp.StatusCode)',
        '}',
      ].join('\n')

    case 'ruby':
      return [
        'require "net/http"',
        'require "json"',
        'require "uri"',
        '',
        `uri = URI.parse("${url}")`,
        'http = Net::HTTP.new(uri.host, uri.port)',
        'http.use_ssl = uri.scheme == "https"',
        '',
        'request = Net::HTTP::Post.new(uri.request_uri)',
        'request["Content-Type"] = "application/json"',
        'request.body = JSON.generate({',
        '  event: "test",',
        '  data: { id: 123 }',
        '})',
        '',
        'response = http.request(request)',
        'puts response.code',
        'puts response.body',
      ].join('\n')

    case 'php':
      return [
        '<?php',
        '',
        `$url = "${url}";`,
        '$payload = json_encode([',
        '    "event" => "test",',
        '    "data" => ["id" => 123],',
        ']);',
        '',
        '$ch = curl_init($url);',
        'curl_setopt($ch, CURLOPT_POST, true);',
        'curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);',
        'curl_setopt($ch, CURLOPT_HTTPHEADER, [',
        '    "Content-Type: application/json",',
        ']);',
        'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);',
        '',
        '$response = curl_exec($ch);',
        '$statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);',
        'curl_close($ch);',
        '',
        'echo "Status: " . $statusCode . "\\n";',
        'echo $response;',
      ].join('\n')

    case 'java':
      return [
        'import java.net.URI;',
        'import java.net.http.HttpClient;',
        'import java.net.http.HttpRequest;',
        'import java.net.http.HttpResponse;',
        '',
        'public class WebhookTest {',
        '    public static void main(String[] args) throws Exception {',
        '        String payload = """',
        '            {"event": "test", "data": {"id": 123}}',
        '            """;',
        '',
        '        HttpClient client = HttpClient.newHttpClient();',
        '        HttpRequest request = HttpRequest.newBuilder()',
        `            .uri(URI.create("${url}"))`,
        '            .header("Content-Type", "application/json")',
        '            .POST(HttpRequest.BodyPublishers.ofString(payload))',
        '            .build();',
        '',
        '        HttpResponse<String> response =',
        '            client.send(request, HttpResponse.BodyHandlers.ofString());',
        '',
        '        System.out.println("Status: " + response.statusCode());',
        '        System.out.println(response.body());',
        '    }',
        '}',
      ].join('\n')

    case 'csharp':
      return [
        'using System.Net.Http;',
        'using System.Text;',
        '',
        'var client = new HttpClient();',
        'var payload = """',
        '    {"event": "test", "data": {"id": 123}}',
        '    """;',
        '',
        'var content = new StringContent(',
        '    payload,',
        '    Encoding.UTF8,',
        '    "application/json"',
        ');',
        '',
        'var response = await client.PostAsync(',
        `    "${url}",`,
        '    content',
        ');',
        '',
        'Console.WriteLine($"Status: {response.StatusCode}");',
        'Console.WriteLine(await response.Content.ReadAsStringAsync());',
      ].join('\n')
  }
}

export function CodeSnippets({ endpointUrl }: CodeSnippetsProps) {
  const [language, setLanguage] = useState<Language>('shell')
  const [isExpanded, setIsExpanded] = useState(false)

  const code = getSnippet(language, endpointUrl)

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent"
            aria-hidden="true"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span className="text-sm font-medium text-text-primary">Send a test webhook</span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between border-b border-border bg-surface px-2">
            <div className="flex overflow-x-auto" role="tablist">
              {LANGUAGES.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={language === tab.id}
                  onClick={() => setLanguage(tab.id)}
                  className={`whitespace-nowrap px-3 py-2 text-xs font-medium transition-colors ${
                    language === tab.id
                      ? 'text-text-primary border-b-2 border-accent'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <CopyButton text={code} label="Copy" className="my-1" />
          </div>

          <pre className="p-4 font-mono text-xs text-text-primary bg-[#0d0d0e] overflow-auto max-h-80 leading-relaxed">
            {code}
          </pre>
        </div>
      )}
    </div>
  )
}
