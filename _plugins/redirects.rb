require 'json'

# Generates redirect pages from _data/redirects.yml.
# Each "path: url" pair becomes /path/index.html, which forwards the visitor
# to url via <meta http-equiv="refresh">, a canonical link and a JS fallback.
module Jekyll
  class RedirectPage < PageWithoutAFile
    def initialize(site, path, target)
      # PageWithoutAFile stubs out read_yaml, so super sets up everything
      # (data, path, basename, ext) without touching the filesystem.
      super(site, site.source, path, 'index.html')

      data['layout'] = nil
      data['sitemap'] = false
      data['redirect_to'] = target
      data['title'] = "Redirecting to #{target}"

      self.content = <<~HTML
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta http-equiv="refresh" content="0; url=#{target}">
            <meta name="robots" content="noindex">
            <link rel="canonical" href="#{target}">
            <title>Redirecting&hellip;</title>
          </head>
          <body>
            <p>Redirecting to <a href="#{target}">#{target}</a>&hellip;</p>
            <script>window.location.replace(#{target.to_json});</script>
          </body>
        </html>
      HTML
    end
  end

  class RedirectGenerator < Generator
    safe true
    priority :low

    def generate(site)
      redirects = site.data['redirects']
      return if redirects.nil? || redirects.empty?

      redirects.each do |path, target|
        next if target.nil? || target.to_s.strip.empty?

        site.pages << RedirectPage.new(site, path.to_s.sub(%r{\A/}, ''), target.to_s.strip)
      end
    end
  end
end
